import {
  Cesium3DTileset,
  Cesium3DTileStyle,
  Cesium3DTileColorBlendMode,
  CustomShader,
  LightingModel,
  CustomShaderTranslucencyMode,
  type Cesium3DTile,
  type CesiumWidget,
} from 'cesium';
import { limitCityRequests } from './city-requests';
import { scopeCitySource } from './city-sources';

export type CityPresentation = 'photo' | 'buildings';
export type CitySources = Partial<Record<CityPresentation, string>>;
export interface CityQuality {
  screenSpaceError: number;
  cacheBytes: number;
}
const INITIAL_ERROR = 128;

export function describeCityFailure(error: unknown, source: string): string {
  const record =
    error && typeof error === 'object'
      ? (error as { message?: unknown; statusCode?: unknown })
      : undefined;
  let message =
    typeof record?.statusCode === 'number'
      ? `HTTP ${record.statusCode}`
      : typeof record?.message === 'string'
        ? record.message
        : typeof error === 'string'
          ? error
          : 'Provider unavailable';
  try {
    for (const [key, value] of new URL(source).searchParams)
      if (/key|token|signature|secret/i.test(key) && value) {
        message = message
          .replaceAll(value, '[redacted]')
          .replaceAll(encodeURIComponent(value), '[redacted]');
      }
  } catch {
    /* Invalid source errors must not print the supplied configuration. */
  }
  return message
    .replace(/https?:\/\/[^\s'"<>]+/g, '[resource URL]')
    .replace(/\b(key|token|signature|secret)=([^\s&'"<>]+)/gi, '$1=[redacted]')
    .slice(0, 240);
}

const emptySnapshot = () => ({
  state: 'not-configured' as 'not-configured' | 'loading' | 'ready' | 'error',
  network: 0,
  processing: 0,
  loaded: 0,
  unloaded: 0,
  failed: 0,
  memoryBytes: 0,
  revealed: false,
  coverageReady: false,
  slow: false,
  firstVisibleMs: null as number | null,
  firstCoverageMs: null as number | null,
});

/** One source owns its own progress, callbacks and GPU resources, even while hidden. */
class CityLayer {
  private tileSet?: Cesium3DTileset;
  private shader?: CustomShader;
  private state = emptySnapshot();
  private requested = false;
  private disposed = false;
  private active = false;
  private navigating = false;
  private started = 0;
  private waitTimer?: ReturnType<typeof setTimeout>;
  private cleanups: Array<() => void> = [];
  constructor(
    private widget: CesiumWidget,
    private source: string,
    private presentation: CityPresentation,
    private quality: CityQuality,
    private changed: () => void,
  ) {}
  snapshot() {
    return { ...this.state, memoryBytes: this.tileSet?.totalMemoryUsageInBytes ?? 0 };
  }
  setActive(active: boolean) {
    if (active && !this.active && !this.state.coverageReady) this.started = performance.now();
    this.active = active;
    if (active) this.warm();
    this.watchProgress();
    this.visibility();
    this.widget.scene.requestRender();
  }
  setQuality(quality: CityQuality) {
    this.quality = quality;
    if (!this.tileSet) return;
    this.tileSet.maximumScreenSpaceError =
      this.presentation === 'photo' || this.state.coverageReady
        ? quality.screenSpaceError
        : Math.max(INITIAL_ERROR, quality.screenSpaceError);
    this.tileSet.cacheBytes = quality.cacheBytes;
    this.tileSet.maximumCacheOverflowBytes = quality.cacheBytes / 2;
  }
  setNavigating(navigating: boolean) {
    this.navigating = navigating;
    if (!this.tileSet) return;
    this.tileSet.cullRequestsWhileMoving = !navigating;
    this.tileSet.foveatedTimeDelay = navigating ? 0 : 0.15;
  }
  warm() {
    if (this.requested || this.disposed) return;
    this.requested = true;
    this.state.state = 'loading';
    this.watchProgress();
    this.changed();
    void this.load();
  }
  private watchProgress() {
    clearTimeout(this.waitTimer);
    this.state.slow = false;
    if (!this.active || this.state.state !== 'loading') return;
    // Offer recovery after a quiet loading period; do not invent an upstream failure
    // or automatically discard useful tiles on a slow connection.
    this.waitTimer = setTimeout(() => {
      if (this.disposed || !this.active || this.state.state !== 'loading') return;
      this.state.slow = true;
      this.changed();
    }, 45000);
  }
  private visibility() {
    if (!this.tileSet) return;
    this.tileSet.show = this.active && this.state.revealed;
    this.tileSet.preloadWhenHidden = this.active && !this.state.revealed;
  }
  private async load() {
    try {
      const url = new URL(scopeCitySource(this.source, window.location.origin));
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Unsupported tileset protocol');
      const tiles = await Cesium3DTileset.fromUrl(url.toString(), {
        maximumScreenSpaceError:
          this.presentation === 'photo'
            ? this.quality.screenSpaceError
            : Math.max(INITIAL_ERROR, this.quality.screenSpaceError),
        cacheBytes: this.quality.cacheBytes,
        maximumCacheOverflowBytes: this.quality.cacheBytes / 2,
        dynamicScreenSpaceError: true,
        foveatedScreenSpaceError: true,
        show: false,
        preloadWhenHidden: this.active,
        preloadFlightDestinations: true,
        // Photo ancestors are extremely coarse at walking range. Request the desired
        // detail directly instead of downloading and displaying those blurred blocks.
        skipLevelOfDetail: this.presentation === 'photo',
        immediatelyLoadDesiredLevelOfDetail: this.presentation === 'photo',
        progressiveResolutionHeightFraction: 0.3,
        cullRequestsWhileMoving: !this.navigating,
        cullRequestsWhileMovingMultiplier: 10,
        foveatedTimeDelay: this.navigating ? 0 : 0.15,
      });
      if (this.disposed) {
        tiles.destroy();
        return;
      }
      this.tileSet = this.widget.scene.primitives.add(tiles);
      if (this.presentation === 'buildings') {
        tiles.style = new Cesium3DTileStyle({ color: 'color("#e4e9e2")' });
        tiles.colorBlendMode = Cesium3DTileColorBlendMode.HIGHLIGHT;
        this.shader = new CustomShader({
          lightingModel: LightingModel.UNLIT,
          translucencyMode: CustomShaderTranslucencyMode.OPAQUE,
          fragmentShaderText: `
            void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
              float light = 0.78 + 0.22 * max(dot(normalize(fsInput.attributes.normalEC), normalize(vec3(-0.3, 0.5, 1.0))), 0.0);
              material.diffuse = vec3(0.88, 0.90, 0.86) * light;
              material.alpha = 1.0;
            }
          `,
        });
        tiles.customShader = this.shader;
      }
      this.setQuality(this.quality);
      this.setNavigating(this.navigating);
      this.visibility();
      this.cleanups.push(
        tiles.loadProgress.addEventListener((network: number, processing: number) => {
          const previousState = this.state.state;
          this.state.network = network;
          this.state.processing = processing;
          if (this.active || this.state.coverageReady)
            // An exhausted failed traversal is not still refining. A later completed
            // view can recover without discarding the useful tiles already in memory.
            this.state.state = tiles.tilesLoaded
              ? 'ready'
              : this.state.failed > 0 && network === 0 && processing === 0
                ? 'error'
                : 'loading';
          if (previousState !== this.state.state) this.watchProgress();
          if (this.active) this.widget.scene.requestRender();
          this.changed();
        }),
        tiles.tileVisible.addEventListener((tile: Cesium3DTile) => {
          if (
            this.active &&
            this.state.firstVisibleMs === null &&
            (tile.content?.geometryByteLength ?? 0) > 0
          ) {
            this.state.firstVisibleMs = Math.round(performance.now() - this.started);
            this.changed();
          }
        }),
        tiles.tileLoad.addEventListener((tile: Cesium3DTile) => {
          this.state.loaded++;
          this.watchProgress();
          // Reveal real geometry progressively for both styles. Waiting for every photo
          // tile to settle can leave a selected 3D view flat indefinitely on slow links.
          if ((tile.content?.geometryByteLength ?? 0) > 0) {
            this.state.revealed = true;
            this.visibility();
            if (this.active) this.widget.scene.requestRender();
          }
          this.changed();
        }),
        tiles.tileUnload.addEventListener(() => this.state.unloaded++),
        tiles.tileFailed.addEventListener((failure?: { message?: unknown }) => {
          this.state.failed++;
          this.state.state = 'error';
          this.watchProgress();
          if (this.active && this.state.failed <= 3)
            console.warn('3D model unavailable:', describeCityFailure(failure, this.source));
          this.changed();
        }),
        tiles.allTilesLoaded.addEventListener(() => {
          // A cancelled/hidden traversal settling is not proof of visible coverage.
          if (!this.active) return;
          this.state.firstCoverageMs ??= Math.round(performance.now() - this.started);
          this.state.coverageReady = this.state.revealed = true;
          this.state.state = 'ready';
          this.watchProgress();
          this.setQuality(this.quality);
          this.visibility();
          this.widget.scene.requestRender();
          this.changed();
        }),
      );
      this.widget.scene.requestRender();
      this.changed();
    } catch (error) {
      if (this.disposed) return;
      console.warn('3D source unavailable:', describeCityFailure(error, this.source));
      this.cleanups.splice(0).forEach((remove) => remove());
      if (this.tileSet) this.widget.scene.primitives.remove(this.tileSet);
      this.tileSet = undefined;
      this.shader?.destroy();
      this.shader = undefined;
      this.state.state = 'error';
      this.watchProgress();
      this.requested = false;
      this.changed();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.waitTimer);
    this.cleanups.forEach((remove) => remove());
    if (this.tileSet) this.widget.scene.primitives.remove(this.tileSet);
    this.shader?.destroy();
  }
}

/** Preserve source caches and camera state while sharing one configured cache budget. */
export class CityLayers {
  private layers = new Map<CityPresentation, CityLayer>();
  private active = false;
  private navigating = false;
  private releases: Array<() => void>;
  constructor(
    private widget: CesiumWidget,
    private sources: CitySources,
    private presentation: CityPresentation,
    private quality: CityQuality,
    private changed: () => void,
  ) {
    this.releases = Object.values(sources).map(limitCityRequests);
    if (!sources[presentation]) this.presentation = sources.photo ? 'photo' : 'buildings';
  }
  get configured() {
    return Boolean(this.sources[this.presentation]);
  }
  get presentationStyle() {
    return this.presentation;
  }
  private layer() {
    const source = this.sources[this.presentation];
    if (!source) return undefined;
    let layer = this.layers.get(this.presentation);
    if (!layer) {
      const key = this.presentation;
      layer = new CityLayer(this.widget, source, key, this.quality, () => {
        if (this.presentation === key) this.changed();
      });
      this.layers.set(key, layer);
      this.setQuality(this.quality);
      layer.setNavigating(this.navigating);
    }
    return layer;
  }
  setPresentation(presentation: CityPresentation) {
    if (presentation === this.presentation || !this.sources[presentation]) return;
    this.layers.get(this.presentation)?.setActive(false);
    this.presentation = presentation;
    const layer = this.layer();
    layer?.warm();
    layer?.setActive(this.active);
    this.changed();
  }
  warm() {
    this.layer()?.warm();
  }
  retry() {
    const current = this.layers.get(this.presentation);
    if (!current) return;
    const state = current.snapshot();
    if (state.state !== 'error' && !state.slow) return;
    current.dispose();
    this.layers.delete(this.presentation);
    this.layer()?.setActive(this.active);
    this.changed();
  }
  setActive(active: boolean) {
    this.active = active;
    if (active) this.layer()?.setActive(true);
    else this.layers.get(this.presentation)?.setActive(false);
  }
  setNavigating(navigating: boolean) {
    this.navigating = navigating;
    this.layers.get(this.presentation)?.setNavigating(navigating);
  }
  setQuality(quality: CityQuality) {
    this.quality = quality;
    const share = { ...quality, cacheBytes: quality.cacheBytes / Math.max(1, this.layers.size) };
    this.layers.forEach((layer) => layer.setQuality(share));
  }
  snapshot() {
    const state = this.layers.get(this.presentation)?.snapshot() ?? emptySnapshot();
    return {
      ...state,
      memoryBytes: [...this.layers.values()].reduce(
        (sum, layer) => sum + layer.snapshot().memoryBytes,
        0,
      ),
    };
  }
  dispose() {
    this.layers.forEach((layer) => layer.dispose());
    this.layers.clear();
    this.releases.forEach((release) => release());
  }
}
