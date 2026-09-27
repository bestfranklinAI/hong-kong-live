import { usePreferences } from '../app/preferences';

/** Planning can override the persisted general map preference. */
export function CityViewControl({
  value,
  onChange,
}: {
  value?: boolean;
  onChange?: (enabled: boolean) => void;
}) {
  const preferred = usePreferences((state) => state.cityView);
  const setPreferred = usePreferences((state) => state.setCityView);
  const enabled = value ?? preferred;
  const setEnabled = onChange ?? setPreferred;
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
