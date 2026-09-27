import {
  Viewer,
  Cesium3DTileset,
  Cartesian3,
  Cartographic,
  Color,
  HeadingPitchRange,
  BoundingSphere,
  Math as CesiumMath,
  ArcType,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './height.css';
import audit from '../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';

// Isolated developer experiment: fixture data is never used by the public route planner.
const viewer = new Viewer('map', {
  baseLayer: false,
  baseLayerPicker: false,
  animation: false,
  timeline: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  requestRenderMode: true,
});
viewer.scene.globe.show = false;
viewer.scene.backgroundColor = Color.fromCssColorString('#152a31');
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const results = document.querySelector<HTMLPreElement>('#results')!;
const height = document.querySelector<HTMLSelectElement>('#height')!;
const offset = document.querySelector<HTMLInputElement>('#offset')!;
const xray = document.querySelector<HTMLInputElement>('#xray')!;
const route = audit.routes['eal-ground'];
const points = audit.points.points.filter((p) => p.z >= 0);
let model: Cesium3DTileset | undefined;
function draw() {
  viewer.entities.removeAll();
  const correction = Number(height.value) + Number(offset.value);
  if (!Number.isFinite(correction)) return;
  for (const path of route.paths)
    viewer.entities.add({
      polyline: {
        positions: path.map(([lng, lat, z]) => Cartesian3.fromDegrees(lng, lat, z + correction)),
        width: 6,
        arcType: ArcType.NONE,
        material: Color.CYAN,
        depthFailMaterial: Color.HOTPINK,
      },
    });
  for (const p of points)
    viewer.entities.add({
      position: Cartesian3.fromDegrees(p.lng, p.lat, p.z + correction),
      point: {
        pixelSize: 12,
        color: Color.YELLOW,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: p.name,
        font: '14px sans-serif',
        fillColor: Color.WHITE,
        showBackground: true,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  viewer.scene.requestRender();
}
function frame() {
  const positions = route.paths.flat().map(([lng, lat, z]) => Cartesian3.fromDegrees(lng, lat, z));
  viewer.camera.flyToBoundingSphere(BoundingSphere.fromPoints(positions), {
    duration: 0,
    offset: new HeadingPitchRange(CesiumMath.toRadians(20), CesiumMath.toRadians(-65), 650),
  });
}
document.querySelector<HTMLButtonElement>('#entrance')!.onclick = () => {
  viewer.camera.flyToBoundingSphere(
    new BoundingSphere(Cartesian3.fromDegrees(114.16601088, 22.27890956, 6), 1),
    {
      duration: 0,
      offset: new HeadingPitchRange(CesiumMath.toRadians(180), CesiumMath.toRadians(-65), 100),
    },
  );
};
height.onchange = draw;
offset.oninput = draw;
xray.onchange = () => {
  if (model) model.show = !xray.checked;
  viewer.scene.requestRender();
};
document.querySelector<HTMLButtonElement>('#frame')!.onclick = frame;
document.querySelector<HTMLButtonElement>('#sample')!.onclick = async () => {
  if (!model || !model.show) {
    status.textContent = 'Show the city model before sampling.';
    return;
  }
  status.textContent = 'Sampling most-detailed available mesh; this can take time…';
  try {
    const samples = await viewer.scene.sampleHeightMostDetailed(
      points.map((p) => Cartographic.fromDegrees(p.lng, p.lat)),
      [...viewer.entities.values],
    );
    results.textContent = JSON.stringify(
      points.map((p, i) => ({
        name: p.name,
        level: p.levelName,
        lat: p.lat,
        lng: p.lng,
        sourceZ: p.z,
        meshHeight: samples[i]?.height ?? null,
        meshMinusRaw: samples[i]?.height === undefined ? null : samples[i].height - p.z,
        meshMinusHKPDHypothesis:
          samples[i]?.height === undefined ? null : samples[i].height - (p.z - 2.618),
      })),
      null,
      2,
    );
    status.textContent = 'Mesh sampled. Roof/deck ambiguity must be checked visually.';
  } catch {
    status.textContent = 'Mesh sampling failed; no inferred measurements.';
  }
};
draw();
frame();
try {
  const url = import.meta.env.VITE_HK_3D_TILESET_URL;
  if (!url) throw new Error('No configured model');
  model = await Cesium3DTileset.fromUrl(url, {
    maximumScreenSpaceError: 2,
    cacheBytes: 256 * 1024 * 1024,
  });
  viewer.scene.primitives.add(model);
  status.textContent = 'Model attached; wait for detail before comparing.';
  model.allTilesLoaded.addEventListener(() => {
    status.textContent = 'Visible model tiles loaded.';
  });
} catch {
  status.textContent = 'Configured city model unavailable.';
}
window.addEventListener('pagehide', () => viewer.destroy(), { once: true });
