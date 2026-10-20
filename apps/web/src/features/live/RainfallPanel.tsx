import { Pause, Play, RefreshCw } from 'lucide-react';
import { hkSourceTime } from '../../shared/format';
import { rainBands } from './rainfall-colors';
import type { RainfallControls } from './use-rainfall';

export function RainfallPanel({ rain }: { rain: RainfallControls }) {
  const { publication, index, query } = rain;
  const frame = publication?.frames[index];
  const delayed =
    query.isError ||
    query.data?.status !== 'fresh' ||
    (publication !== null && rain.now - Date.parse(publication.issuedAt) >= 24 * 60_000);
  return (
    <section className="rainfall-panel" aria-label="Rainfall forecast">
      <h2>Rainfall forecast</h2>
      <p>Next two hours · HKO · mm per half-hour</p>
      <span className={`status-label ${publication && !delayed ? 'fresh' : ''}`}>
        <span />
        {query.data?.mode === 'fixture'
          ? 'Recorded test snapshot'
          : query.isPending
            ? 'Preparing rainfall forecast…'
            : !publication
              ? 'Rainfall unavailable'
              : delayed
                ? 'Update delayed · last usable forecast'
                : 'Latest forecast'}
      </span>
      {frame ? (
        <>
          <div className="rainfall-period">
            <strong>
              {hkSourceTime(frame.startsAt)} – {hkSourceTime(frame.endsAt)}
            </strong>
            <small>Hong Kong time · half-hour total</small>
          </div>
          <div className="rainfall-playback">
            <button
              className="icon-button"
              aria-label={rain.playing ? 'Pause rainfall playback' : 'Play rainfall forecast'}
              onClick={rain.togglePlay}
            >
              {rain.playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <input
              aria-label="Rainfall forecast period"
              type="range"
              min={Math.max(
                0,
                publication!.frames.findIndex((frame) => Date.parse(frame.endsAt) > rain.now),
              )}
              max="3"
              step="1"
              value={index}
              onChange={(e) => rain.select(Number(e.target.value))}
            />
            <span>{index + 1} / 4</span>
          </div>
          <div
            className={`rainfall-legend ${rain.style === 'smooth' ? 'rainfall-legend--smooth' : ''}`}
            aria-label="Rainfall legend in millimetres per half-hour"
          >
            {rainBands.map((band) => (
              <span key={band.min}>
                <i style={{ background: band.color }} />
                {rain.style === 'smooth' ? (band.min === 20 ? '20+' : band.min) : band.label}
              </span>
            ))}
          </div>
          <small>Grey = no data · clear = no forecast rain</small>
          {frame.values.every((value) => value === 0) && (
            <p>No rainfall is forecast across this grid for this period.</p>
          )}
        </>
      ) : (
        <p role="status">
          {query.isPending
            ? 'Loading the latest HKO forecast. This can take up to 45 seconds.'
            : query.data?.error ||
              'No current forecast can be displayed. The rainfall overlay is hidden.'}
        </p>
      )}
      <p className="rainfall-source">Issued: {hkSourceTime(query.data?.sourceUpdatedAt)}</p>
      <details className="rainfall-display-options">
        <summary>Display & source</summary>
        <div className="rainfall-style" role="group" aria-label="Rainfall appearance">
          <button aria-pressed={rain.style === 'smooth'} onClick={() => rain.setStyle('smooth')}>
            Smooth
          </button>
          <button aria-pressed={rain.style === 'grid'} onClick={() => rain.setStyle('grid')}>
            Source grid
          </button>
        </div>
        <p>
          Provisional forecast, not observed radar. Outside the grid there is no coverage. Smooth
          display changes appearance, not the source resolution; faint rain fades near zero.
        </p>
        <p className="rainfall-source">Fetched: {hkSourceTime(query.data?.fetchedAt)}</p>
        <button
          className="text-button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={14} />
          Refresh rainfall
        </button>
        <a
          className="text-button"
          href="https://data.gov.hk/en-data/dataset/hk-hko-rss-gridded-rainfall-nowcast-in-hong-kong"
          target="_blank"
          rel="noreferrer"
        >
          HKO forecast source ↗
        </a>
      </details>
    </section>
  );
}
