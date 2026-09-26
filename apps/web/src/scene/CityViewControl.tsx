import { usePreferences } from '../app/preferences';

/** One persisted choice shared by desktop controls and the mobile settings sheet. */
export function CityViewControl() {
  const enabled = usePreferences((state) => state.cityView);
  const setEnabled = usePreferences((state) => state.setCityView);
  const available = Boolean(import.meta.env.VITE_HK_3D_TILESET_URL);
  return (
    <label>
      <span>Map dimension</span>
      <select
        aria-label="Map dimension"
        value={enabled && available ? '3d' : '2d'}
        onChange={(event) => setEnabled(event.target.value === '3d')}
      >
        <option value="2d">2D map</option>
        <option value="3d" disabled={!available}>
          3D city{available ? '' : ' · not connected'}
        </option>
      </select>
    </label>
  );
}
