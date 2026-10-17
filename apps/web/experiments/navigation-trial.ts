import 'cesium/Build/Cesium/Widgets/widgets.css';
import { SceneController } from '../src/scene/SceneController';
import { RequestScheduler } from 'cesium';
import { walkingRouteSchema } from '@hk/contracts';
import fixture from '../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';
import type { LocationFix } from '../src/scene/UserLocation';
if (!import.meta.env.DEV) throw new Error('Development replay only.');
const route = walkingRouteSchema.parse(fixture.routes['eal-ground']);
const params = new URLSearchParams(location.search);
const requestLimit = Number(params.get('requests'));
const objectModel = params.get('model') === 'objects';
const cleanModel = objectModel || params.get('model') === 'clean';
let tilesetUrl = import.meta.env.VITE_HK_3D_TILESET_URL;
if (cleanModel && tilesetUrl) {
  const source = new URL(tilesetUrl);
  if (source.origin !== 'https://data.map.gov.hk')
    throw new Error('Clean trial requires LandsD source');
  source.pathname = objectModel
    ? '/api/3d-data/3dsd/WGS84/building/tileset.json'
    : '/api/3d-data/3dtiles/t_bi_f1/tileset.json';
  tilesetUrl = source.toString();
  document.querySelector('h1')!.textContent = objectModel
    ? 'Walking replay · LandsD building objects'
    : 'Walking replay · non-textured LandsD models';
}
const status = document.querySelector<HTMLOutputElement>('#status')!;
const pose = document.querySelector<HTMLOutputElement>('#pose')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const follow = document.querySelector<HTMLButtonElement>('#follow')!;
let city = Boolean(import.meta.env.VITE_HK_3D_TILESET_URL) && params.get('view') !== '2d',
  following = true,
  playing = false,
  index = 0,
  t = 0;
const scene = new SceneController(document.querySelector('#map')!, {
  onSelect: () => {},
  onStatus: (value) => {
    status.textContent = value.message;
  },
  onFollowChange: (value) => {
    following = value;
    follow.textContent = value ? 'Following' : 'Recentre';
  },
  creditContainer: document.querySelector<HTMLElement>('#credits')!,
  performanceOutput: document.querySelector<HTMLElement>('#metrics')!,
  measurePerformance: true,
  cityPresentation: cleanModel ? 'buildings' : 'photo',
  tilesetUrl,
  basemap: 'landsd-map',
  mapLanguage: 'en',
});
if ([4, 6, 12, 18].includes(requestLimit))
  RequestScheduler.requestsByServer['data.map.gov.hk:443'] = requestLimit;
scene.setQuality('balanced');
scene.setCityView(city);
document.querySelector('#view')!.textContent = city ? 'Switch to 2D' : 'Switch to 3D';
scene.setWalkingRoute(route, city, true);
const segments = route.paths.flatMap((path) => path.slice(1).map((b, i) => ({ a: path[i], b })));
let fix: LocationFix | null = null,
  z: number | null = null;
// Do not enter follow mode before a simulated fix: that would cancel the overview flight.
const update = () =>
  scene.setNavigation({ planning: true, active: fix !== null, following, fix, z });
update();
function tick() {
  let remaining = 4;
  const lengthOf = (segment: (typeof segments)[number]) =>
    Math.hypot(
      (segment.b[0] - segment.a[0]) * Math.cos((segment.a[1] * Math.PI) / 180) * 111195,
      (segment.b[1] - segment.a[1]) * 111195,
      segment.a[2] !== null && segment.b[2] !== null ? segment.b[2] - segment.a[2] : 0,
    );
  let length = lengthOf(segments[index]);
  let guard = 0;
  while (remaining >= (1 - t) * length && guard++ < segments.length) {
    remaining -= (1 - t) * length;
    index = (index + 1) % segments.length;
    t = 0;
    length = lengthOf(segments[index]);
  }
  if (length) t += remaining / length;
  const { a, b } = segments[index];
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180),
    dy = b[1] - a[1];
  fix = {
    lng: a[0] + (b[0] - a[0]) * Math.min(1, t),
    lat: a[1] + (b[1] - a[1]) * Math.min(1, t),
    heading: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
    accuracy: 0,
  };
  z = a[2] !== null && b[2] !== null ? a[2] + (b[2] - a[2]) * Math.min(1, t) : null;
  update();
  const camera = window.__HK_SCENE__?.snapshot().camera;
  pose.textContent = `Simulated segment ${index + 1}/${segments.length} · ${following ? 'following' : 'free map'}${camera ? ` · camera ${camera.lng.toFixed(5)}, ${camera.lat.toFixed(5)} / ${Math.round(camera.heading)}°` : ''}`;
}
play.addEventListener('click', () => {
  playing = !playing;
  play.textContent = playing ? 'Pause replay' : 'Play replay';
  if (playing) tick();
});
follow.addEventListener('click', () => {
  following = true;
  update();
  follow.textContent = 'Following';
});
document.querySelector('#view')!.addEventListener('click', () => {
  city = !city;
  scene.setCityView(city);
  scene.setWalkingRoute(route, city, true);
  update();
  document.querySelector('#view')!.textContent = city ? 'Switch to 2D' : 'Switch to 3D';
});
const timer = setInterval(() => {
  if (playing) tick();
  const d = window.__HK_SCENE__?.snapshot();
  if (d)
    document.querySelector('#tiles')!.textContent =
      `Tiles: ${d.cityTiles} · network ${d.cityNetworkRequests} · processing ${d.cityProcessingTiles} · loaded ${d.loadedCityTiles} · unloaded ${d.unloadedCityTiles} · ${(d.cityMemoryBytes / 1024 ** 2).toFixed(1)} MiB · first shown ${d.firstCityVisibleMs === null ? 'waiting' : `${(d.firstCityVisibleMs / 1000).toFixed(1)}s`} · coverage ${d.firstCityCoverageMs === null ? 'preloading' : `${(d.firstCityCoverageMs / 1000).toFixed(1)}s`} · failed ${d.failedCityTiles} · rendered frames ${d.renderedFrames}`;
}, 1000);
window.addEventListener(
  'pagehide',
  () => {
    clearInterval(timer);
    scene.dispose();
  },
  { once: true },
);
