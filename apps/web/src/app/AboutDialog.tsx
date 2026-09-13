import { Dialog } from '@base-ui/react/dialog';
import { ArrowUpRight, Info, X } from 'lucide-react';

export function AboutDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="icon-button about-trigger"
        aria-label="About this atlas"
        title="About this atlas"
      >
        <Info size={20} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="about-dialog">
          <div className="dialog-top">
            <span className="eyebrow">HONG KONG LIVE · FIRST LOOK</span>
            <Dialog.Close className="icon-button" aria-label="Close about">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Title>A city worth exploring.</Dialog.Title>
          <Dialog.Description>
            An independent atlas bringing Hong Kong’s places and public information a little closer.
          </Dialog.Description>
          <dl>
            <dt>The map</dt>
            <dd>
              Public Lands Department maps and aerial imagery, with English or Traditional Chinese
              labels, on a flat globe. OpenStreetMap is also available. Textured 3D city data is
              available when a project-authorised Lands Department tileset is configured. The
              default view does not contain 3D buildings or terrain relief.
            </dd>
            <dt>The places</dt>
            <dd>
              A curated bilingual catalogue with links to official information. Pins are approximate
              navigation centres, not verified entrances.
            </dd>
            <dt>The live information</dt>
            <dd>
              HKO station observations and selected MTR departures. Source times are shown in Hong
              Kong time. Failed requests are labelled; recorded test data is always identified.
            </dd>
            <dt>Coming into view</dt>
            <dd>
              Rainfall playback, buses, minibuses, traffic cameras and indoor station floors will
              arrive in subsequent stages.
            </dd>
          </dl>
          <a
            className="text-button"
            href="https://data.gov.hk/en/"
            target="_blank"
            rel="noreferrer"
          >
            Explore Hong Kong open data <ArrowUpRight size={15} />
          </a>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
