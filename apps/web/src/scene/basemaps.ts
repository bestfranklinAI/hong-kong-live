import {
  Credit,
  OpenStreetMapImageryProvider,
  Rectangle,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
  type ImageryProvider,
} from 'cesium';

export type Basemap = 'landsd-map' | 'landsd-aerial' | 'openstreetmap';
export type MapLanguage = 'en' | 'tc';
export type SceneBasemap = Basemap | 'none';
export const basemapNames: Record<SceneBasemap, string> = {
  'landsd-map': 'LandsD map',
  'landsd-aerial': 'LandsD aerial',
  openstreetmap: 'OpenStreetMap',
  none: 'Test scene',
};
const API = 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz';

function landsCredit(aerial: boolean) {
  return new Credit(
    `<a href="https://www.landsd.gov.hk/" target="_blank" rel="noopener noreferrer"><img src="/landsd-logo.jpg" width="28" height="28" alt="Lands Department"></a> <span>${aerial ? 'Aerial Photograph from Lands Department' : 'Map from Lands Department'}</span>`,
    true,
  );
}

/** Public WGS84 XYZ services use Web Mercator tiles, unlike the separate HK80 grid. */
export interface BasemapLayerDefinition {
  key: string;
  create: () => ImageryProvider;
}

export function basemapLayerDefinitions(
  basemap: SceneBasemap,
  language: MapLanguage,
): BasemapLayerDefinition[] {
  if (basemap === 'none') return [];
  if (basemap === 'openstreetmap')
    return [
      {
        key: 'openstreetmap',
        create: () =>
          new OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
            maximumLevel: 19,
            credit: new Credit(
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
              true,
            ),
          }),
      },
    ];
  // Restrict requests to the Hong Kong study area. Outside it, the globe remains blank.
  // Do not request unavailable topographic zooms below 10 or prefetch the territory.
  const common = {
    tilingScheme: new WebMercatorTilingScheme(),
    rectangle: Rectangle.fromDegrees(113.83, 22.1, 114.45, 22.58),
    minimumLevel: 10,
    maximumLevel: 20,
    enablePickFeatures: false,
  };
  const aerial = basemap === 'landsd-aerial';
  return [
    // A transparent global base stops Cesium stretching regional edge tiles across the globe.
    {
      key: 'neutral',
      create: () =>
        new SingleTileImageryProvider({
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
          tileWidth: 1,
          tileHeight: 1,
        }),
    },
    {
      key: basemap,
      create: () =>
        new UrlTemplateImageryProvider({
          ...common,
          url: `${API}/${aerial ? 'imagery' : 'basemap'}/WGS84/{z}/{x}/{y}.png`,
          credit: landsCredit(aerial),
        }),
    },
    {
      key: `labels:${basemap}:${language}`,
      create: () =>
        new UrlTemplateImageryProvider({
          ...common,
          url: `${API}/label/hk/${language}/WGS84/{z}/{x}/{y}.png`,
          credit: aerial ? new Credit('Map from Lands Department', true) : undefined,
        }),
    },
  ];
}
