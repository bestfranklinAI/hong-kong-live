import { CityViewControl } from '../../scene/CityViewControl';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { usePreferences } from '../../app/preferences';
import type { SceneCommand } from '../../scene/types';

export function MapSettings({
  open,
  onOpenChange,
  command,
  status,
  cityView,
  onCityViewChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: (command: SceneCommand['type']) => void;
  status: string;
  cityView?: boolean;
  onCityViewChange?: (enabled: boolean) => void;
}) {
  const preferences = usePreferences();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="about-dialog map-settings">
          <div className="dialog-top">
            <span className="eyebrow">MAKE IT YOUR MAP</span>
            <Dialog.Close className="icon-button" aria-label="Close map settings">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Title>Map & appearance</Dialog.Title>
          <Dialog.Description>Choose your view, labels and graphics quality.</Dialog.Description>
          <label>
            Map style
            <select
              value={preferences.basemap}
              onChange={(e) => preferences.setBasemap(e.target.value as typeof preferences.basemap)}
            >
              <option value="landsd-map">Standard · Lands Department</option>
              <option value="landsd-aerial">Satellite · aerial imagery</option>
              <option value="openstreetmap">OpenStreetMap</option>
            </select>
          </label>
          <label>
            Map label language
            <select
              value={preferences.mapLanguage}
              disabled={preferences.basemap === 'openstreetmap'}
              onChange={(e) =>
                preferences.setMapLanguage(e.target.value as typeof preferences.mapLanguage)
              }
            >
              <option value="en">English</option>
              <option value="tc">繁體中文</option>
            </select>
          </label>
          <label>
            Graphics quality
            <select
              value={preferences.quality}
              onChange={(e) => preferences.setQuality(e.target.value as typeof preferences.quality)}
            >
              <option value="efficient">Eco · lighter on your phone</option>
              <option value="balanced">Standard</option>
              <option value="detailed">High detail</option>
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              command('toggle-pitch');
              onOpenChange(false);
            }}
          >
            Toggle flat / tilted view
          </button>
          <CityViewControl value={cityView} onChange={onCityViewChange} />
          <details>
            <summary>Map & data credits</summary>
            <p>
              Map from{' '}
              <a href="https://www.landsd.gov.hk/" target="_blank" rel="noreferrer">
                Lands Department
              </a>
              . Railway alignment and OSM basemap ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL). Map renderer: Cesium. The map watermark includes active layer credits.
            </p>
            <p>
              Weather: Hong Kong Observatory / Windy. Train times: MTR. Bus times: KMB / Citybus.
              Traffic images: Transport Department. Train positions are timing illustrations, not
              GPS tracking.
            </p>
            <p>{status}</p>
          </details>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
