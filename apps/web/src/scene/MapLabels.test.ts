// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { Cartesian2, Event as CesiumEvent, SceneTransforms, type CesiumWidget } from 'cesium';
import { MapLabels } from './MapLabels';
import { coordinateResult } from '@hk/contracts';
afterEach(() => document.body.replaceChildren());
it('keeps accessible bilingual station labels above 3D and preserves native map hit testing', () => {
  vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(180, 220));
  const preRender = new CesiumEvent();
  const container = document.body.appendChild(document.createElement('div'));
  const widget = {
    container,
    canvas: { clientWidth: 390, clientHeight: 844 },
    camera: { positionCartographic: { height: 1500 }, moveEnd: new CesiumEvent() },
    scene: { preRender, requestRender: vi.fn() },
  } as unknown as CesiumWidget;
  const station = vi.fn();
  const labels = new MapLabels(widget, vi.fn(), station, () => ({ top: 80, bottom: 140 }));
  preRender.raiseEvent();
  const visible = container.querySelectorAll('button:not([hidden])');
  expect(visible).toHaveLength(1);
  expect(visible[0].getAttribute('aria-label')).toMatch(/^MTR/);
  expect(labels.pickAt(new Cartesian2(180, 200))).toBe(true);
  expect(station).toHaveBeenCalledOnce();
  labels.setLanguage('tc');
  preRender.raiseEvent();
  expect(container.querySelector('button:not([hidden])')?.textContent).toMatch(/[\u4e00-\u9fff]/);
  labels.setTarget({
    ...coordinateResult({ lat: 22.28, lng: 114.16 }),
    name: 'Chosen place',
    nameZh: '',
  });
  preRender.raiseEvent();
  expect(container.querySelector('button:not([hidden])')?.textContent).toContain('Chosen place');
  labels.setVisible(false);
  expect(labels.pickAt(new Cartesian2(180, 200))).toBe(false);
  labels.dispose();
  expect(preRender.numberOfListeners).toBe(0);
  expect(container.childElementCount).toBe(0);
});

it('opens a covered building plan from a selected map chip using its official venue ID', () => {
  vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(180, 220));
  const preRender = new CesiumEvent();
  const container = document.body.appendChild(document.createElement('div'));
  const widget = {
    container,
    canvas: { clientWidth: 390, clientHeight: 844 },
    camera: { positionCartographic: { height: 1500 }, moveEnd: new CesiumEvent() },
    scene: { preRender, requestRender: vi.fn() },
  } as unknown as CesiumWidget;
  const open = vi.fn();
  const labels = new MapLabels(
    widget,
    vi.fn(),
    vi.fn(),
    () => ({ top: 80, bottom: 140 }),
    vi.fn(),
    open,
  );
  const venue = {
    id: 'c598bde2-fb35-427c-9ad6-8ffb6abbadf9',
    name: 'Billion Centre',
    nameZh: '億京中心',
    kind: 'building' as const,
    location: { lat: 22.321, lng: 114.206 },
  };
  labels.setIndoorVenues([venue]);
  labels.setTarget({ ...coordinateResult(venue.location), name: venue.name });
  preRender.raiseEvent();
  const chip = container.querySelector<HTMLButtonElement>('.map-context-label--target')!;
  expect(chip.hidden).toBe(false);
  expect(chip.getAttribute('aria-label')).toBe('Indoor map · Billion Centre');
  expect(labels.pickAt(new Cartesian2(180, 150))).toBe(true);
  expect(open).toHaveBeenCalledWith(venue);
  labels.dispose();
});

it('prioritises a station route-section chip and opens its floor inspector through canvas hit testing', () => {
  vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(180, 220));
  const preRender = new CesiumEvent();
  const container = document.body.appendChild(document.createElement('div'));
  const widget = {
    container,
    canvas: { clientWidth: 390, clientHeight: 844 },
    camera: { positionCartographic: { height: 1800 }, moveEnd: new CesiumEvent() },
    scene: { preRender, requestRender: vi.fn() },
  } as unknown as CesiumWidget;
  const open = vi.fn();
  const labels = new MapLabels(
    widget,
    vi.fn(),
    vi.fn(),
    () => ({ top: 80, bottom: 140 }),
    undefined,
    undefined,
    open,
  );
  labels.setRouteStations([
    { id: 'kowloon', name: 'Kowloon Station', nameZh: '九龍鐵路站', lat: 22.304, lng: 114.161 },
  ]);
  preRender.raiseEvent();
  expect(
    container.querySelector<HTMLButtonElement>('.map-context-label--station-section')!.hidden,
  ).toBe(false);
  expect(labels.pickAt(new Cartesian2(180, 200))).toBe(true);
  expect(open).toHaveBeenCalledWith('kowloon');
  labels.dispose();
});
