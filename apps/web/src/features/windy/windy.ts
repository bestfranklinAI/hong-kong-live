export const windyLayers = [
  { id: 'radar', label: 'Weather radar', group: 'Radar & satellite' },
  { id: 'satellite', label: 'Satellite', group: 'Radar & satellite' },
  { id: 'wind', label: 'Wind', group: 'Wind & atmosphere' },
  { id: 'gust', label: 'Wind gusts', group: 'Wind & atmosphere' },
  { id: 'pressure', label: 'Air pressure', group: 'Wind & atmosphere' },
  { id: 'temp', label: 'Temperature', group: 'Temperature & humidity' },
  { id: 'rh', label: 'Relative humidity', group: 'Temperature & humidity' },
  { id: 'rain', label: 'Rain & thunder', group: 'Rain & snow' },
  { id: 'snow', label: 'New snow', group: 'Rain & snow' },
  { id: 'snowcover', label: 'Snow depth', group: 'Rain & snow' },
  { id: 'clouds', label: 'Clouds', group: 'Clouds' },
  { id: 'lclouds', label: 'Low clouds', group: 'Clouds' },
  { id: 'waves', label: 'Waves', group: 'Sea & swell' },
  { id: 'swell', label: 'Swell', group: 'Sea & swell' },
  { id: 'wwaves', label: 'Wind waves', group: 'Sea & swell' },
  { id: 'swellperiod', label: 'Swell period', group: 'Sea & swell' },
] as const;
export type WindyLayer = (typeof windyLayers)[number]['id'];
export function windyUrl(layer: WindyLayer, detail: boolean) {
  const marine = windyLayers.find((l) => l.id === layer)?.group === 'Sea & swell';
  const params = new URLSearchParams({
    type: 'map',
    location: 'coordinates',
    metricRain: 'mm',
    metricTemp: '°C',
    metricWind: 'km/h',
    zoom: '10',
    overlay: layer,
    product: layer === 'radar' || layer === 'satellite' ? layer : marine ? 'ecmwfWaves' : 'ecmwf',
    level: 'surface',
    lat: '22.293',
    lon: '114.203',
    detailLat: '22.293',
    detailLon: '114.203',
    message: 'true',
    ...(detail ? { detail: 'true' } : {}),
  });
  return `https://embed.windy.com/embed.html?${params}`;
}
