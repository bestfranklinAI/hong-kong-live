/** Official map-name annotation; not a verified entrance, address or indoor position. */
export interface MapNameLabel {
  id: string;
  text: string;
  kind: 'street' | 'building';
  lng: number;
  lat: number;
}
