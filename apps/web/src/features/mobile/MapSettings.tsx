import { CityViewControl } from '../../scene/CityViewControl';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { usePreferences } from '../../app/preferences';
import { configuredCitySources } from '../../scene/city-sources';

export function MapSettings({
  open,
  onOpenChange,
  status,
  cityView,
  onCityViewChange,
  onRetryCity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: string;
  cityView?: boolean;
  onCityViewChange?: (enabled: boolean) => void;
  onRetryCity?: () => void;
}) {
  const preferences = usePreferences();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="about-dialog map-settings">
          <div className="dialog-top">
            <Dialog.Title>Map settings</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close map settings">
              <X size={20} />
            </Dialog.Close>
          </div>
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
          <CityViewControl value={cityView} onChange={onCityViewChange} />
          {(configuredCitySources.buildings || configuredCitySources.photo) && (
            <label>
              3D style
              <select
                value={preferences.cityPresentation}
                onChange={(event) => {
                  const style = event.target.value as typeof preferences.cityPresentation;
                  preferences.setCityPresentation(style);
                  // Pair each 3D treatment with a coherent ground layer; it remains editable.
                  preferences.setBasemap(style === 'photo' ? 'landsd-aerial' : 'landsd-map');
                }}
              >
                <option value="buildings" disabled={!configuredCitySources.buildings}>
                  Clean buildings
                </option>
                <option value="photo" disabled={!configuredCitySources.photo}>
                  Photo city
                </option>
              </select>
            </label>
          )}
          {onRetryCity && (
            <button className="text-button" onClick={onRetryCity}>
              Retry 3D loading
            </button>
          )}
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
