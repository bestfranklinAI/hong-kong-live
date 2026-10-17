import { afterEach, expect, it, vi } from 'vitest';
import { Cesium3DTileset, Event, type CesiumWidget } from 'cesium';
import { CityLayers, describeCityFailure } from './CityLayers';

const managers: CityLayers[] = [];
afterEach(() => {
  managers.splice(0).forEach((manager) => manager.dispose());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function tileSet() {
  return {
    show: false,
    preloadWhenHidden: false,
    tilesLoaded: false,
    totalMemoryUsageInBytes: 4 * 1024 ** 2,
    loadProgress: new Event(),
    tileLoad: new Event(),
    tileVisible: new Event(),
    tileUnload: new Event(),
    tileFailed: new Event(),
    allTilesLoaded: new Event(),
    destroy: vi.fn(),
  };
}
function setup() {
  vi.stubGlobal('window', { location: { origin: 'https://local.test' } });
  const photo = tileSet(),
    buildings = tileSet();
  const create = vi
    .spyOn(Cesium3DTileset, 'fromUrl')
    .mockImplementation(
      async (url) =>
        (String(url).includes('buildings') ? buildings : photo) as unknown as Cesium3DTileset,
    );
  const primitives = { add: vi.fn((item) => item), remove: vi.fn() };
  const widget = { scene: { primitives, requestRender: vi.fn() } } as unknown as CesiumWidget;
  const manager = new CityLayers(
    widget,
    {
      photo: 'https://example.test/photo.json',
      buildings: 'https://example.test/buildings.json',
    },
    'photo',
    { screenSpaceError: 20, cacheBytes: 192 * 1024 ** 2 },
    vi.fn(),
  );
  managers.push(manager);
  return { manager, photo, buildings, create, primitives };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

it('offers manual recovery after loading makes no progress, without starting automatic retries', async () => {
  vi.useFakeTimers();
  const { manager, photo, create } = setup();
  manager.setActive(true);
  await flush();
  vi.advanceTimersByTime(30000);
  photo.tileLoad.raiseEvent({ content: { geometryByteLength: 128 } });
  vi.advanceTimersByTime(30000);
  expect(manager.snapshot().slow).toBe(false);
  vi.advanceTimersByTime(15000);
  expect(manager.snapshot()).toMatchObject({ state: 'loading', slow: true });
  expect(create).toHaveBeenCalledOnce();
  manager.retry();
  await flush();
  expect(create).toHaveBeenCalledTimes(2);
  expect(manager.snapshot().slow).toBe(false);
  manager.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels slow-loading detection when 3D is hidden', async () => {
  vi.useFakeTimers();
  const { manager } = setup();
  manager.setActive(true);
  await flush();
  manager.setActive(false);
  vi.advanceTimersByTime(60000);
  expect(manager.snapshot().slow).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps useful error diagnostics without provider URLs or access credentials', () => {
  const secret = 'test-key-with-special+characters';
  const source = `https://example.test/tileset.json?key=${encodeURIComponent(secret)}`;
  const message = describeCityFailure(
    new Error(`Failed ${source}, key=${secret}, ${encodeURIComponent(secret)}`),
    source,
  );
  expect(message).not.toContain(secret);
  expect(message).not.toContain(encodeURIComponent(secret));
  expect(message).not.toContain('https://');
  expect(describeCityFailure({ statusCode: 403 }, source)).toBe('HTTP 403');
});

it('warms only metadata in 2D and never treats hidden completion as visible coverage', async () => {
  const { manager, photo, create } = setup();
  manager.warm();
  await flush();
  expect(photo.show).toBe(false);
  expect(photo.preloadWhenHidden).toBe(false);
  photo.tilesLoaded = true;
  photo.loadProgress.raiseEvent(0, 0);
  expect(manager.snapshot().state).toBe('loading');
  photo.allTilesLoaded.raiseEvent();
  expect(manager.snapshot().coverageReady).toBe(false);
  manager.setActive(true);
  expect(photo.preloadWhenHidden).toBe(true);
  photo.allTilesLoaded.raiseEvent();
  expect(photo.show).toBe(true);
  manager.setActive(false);
  manager.setActive(true);
  expect(create).toHaveBeenCalledOnce();
  expect(photo.show).toBe(true);
});

it('streams building geometry without calling the partial view complete coverage', async () => {
  const { manager, buildings } = setup();
  manager.setPresentation('buildings');
  manager.setActive(true);
  await flush();
  buildings.tileLoad.raiseEvent({ content: { geometryByteLength: 128 } });
  expect(buildings.show).toBe(true);
  expect(manager.snapshot()).toMatchObject({
    revealed: true,
    coverageReady: false,
    firstVisibleMs: null,
  });
  buildings.tileVisible.raiseEvent({ content: { geometryByteLength: 128 } });
  expect(manager.snapshot().firstVisibleMs).not.toBeNull();
  buildings.allTilesLoaded.raiseEvent();
  expect(manager.snapshot().coverageReady).toBe(true);
});

it('reveals photo geometry before the entire initial queue settles', async () => {
  const { manager, photo, create } = setup();
  manager.setActive(true);
  await flush();
  expect(create.mock.calls[0][1]).toMatchObject({
    maximumScreenSpaceError: 20,
    skipLevelOfDetail: true,
    immediatelyLoadDesiredLevelOfDetail: true,
  });
  photo.loadProgress.raiseEvent(6, 0);
  photo.tileLoad.raiseEvent({ content: { geometryByteLength: 1024 } });
  expect(photo.show).toBe(true);
  expect(photo.preloadWhenHidden).toBe(false);
  expect(manager.snapshot()).toMatchObject({
    state: 'loading',
    revealed: true,
    coverageReady: false,
  });
  photo.tileVisible.raiseEvent({ content: { geometryByteLength: 1024 } });
  expect(manager.snapshot().firstVisibleMs).not.toBeNull();
});

it('reports a failed settled view instead of endless refinement and recovers on completed coverage', async () => {
  const { manager, buildings } = setup();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  manager.setPresentation('buildings');
  manager.setActive(true);
  await flush();
  buildings.tileLoad.raiseEvent({ content: { geometryByteLength: 128 } });
  buildings.tileFailed.raiseEvent({ message: 'Network unavailable' });
  buildings.loadProgress.raiseEvent(0, 0);
  expect(manager.snapshot()).toMatchObject({ state: 'error', revealed: true, failed: 1 });
  expect(buildings.show).toBe(true);
  buildings.loadProgress.raiseEvent(1, 0);
  expect(manager.snapshot().state).toBe('loading');
  buildings.tilesLoaded = true;
  buildings.loadProgress.raiseEvent(0, 0);
  buildings.allTilesLoaded.raiseEvent();
  expect(manager.snapshot()).toMatchObject({ state: 'ready', coverageReady: true });
});

it('retains both sources under one cache budget and isolates late callbacks from the other style', async () => {
  const { manager, photo, buildings, create, primitives } = setup();
  manager.setActive(true);
  await flush();
  manager.setPresentation('buildings');
  await flush();
  expect(photo.show).toBe(false);
  expect(photo.preloadWhenHidden).toBe(false);
  const allocated = [photo, buildings] as unknown as Array<{ cacheBytes: number }>;
  expect(allocated.reduce((sum, item) => sum + item.cacheBytes, 0)).toBe(192 * 1024 ** 2);
  photo.tileFailed.raiseEvent();
  expect(manager.snapshot().failed).toBe(0);
  manager.setPresentation('photo');
  expect(create).toHaveBeenCalledTimes(2);
  expect(manager.snapshot().failed).toBe(1);
  manager.dispose();
  expect(primitives.remove).toHaveBeenCalledTimes(2);
});

it('destroys a manifest result that arrives after renderer disposal', async () => {
  const { manager, create, primitives } = setup();
  let finish!: (value: Cesium3DTileset) => void;
  create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  manager.setActive(true);
  manager.dispose();
  const late = tileSet();
  finish(late as unknown as Cesium3DTileset);
  await flush();
  expect(late.destroy).toHaveBeenCalledOnce();
  expect(primitives.add).not.toHaveBeenCalled();
});

it('retries only the failed source without replacing the renderer or the other style cache', async () => {
  const { manager, photo, buildings, create, primitives } = setup();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  manager.setActive(true);
  await flush();
  manager.setPresentation('buildings');
  await flush();
  manager.retry();
  expect(create).toHaveBeenCalledTimes(2);
  buildings.tileFailed.raiseEvent();
  manager.retry();
  await flush();
  expect(primitives.remove).toHaveBeenCalledWith(buildings);
  expect(primitives.remove).not.toHaveBeenCalledWith(photo);
  expect(create).toHaveBeenCalledTimes(3);
  manager.setPresentation('photo');
  expect(create).toHaveBeenCalledTimes(3);
});
