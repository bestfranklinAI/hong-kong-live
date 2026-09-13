import { ArrowUpRight, RefreshCw, TrainFront } from 'lucide-react';
import { mtrLines, mtrStations, type StationSelection } from '@hk/contracts';
import { useArrivals } from './queries';
import { hkSourceTime, hkTime } from '../../shared/format';

export function TransportPanel({
  animation,
  onAnimation,
  pickedTrain,
  selection,
  onSelect,
}: {
  animation: boolean;
  onAnimation: (value: boolean) => void;
  pickedTrain: import('@hk/contracts').Arrival | null;
  selection: StationSelection;
  onSelect: (selection: StationSelection) => void;
}) {
  const line = mtrLines.find((line) => line.code === selection.line)!;
  const station = mtrStations[selection.station];
  const query = useArrivals(selection.line, selection.station);
  const feed = query.data;
  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">YOUR NEXT CONNECTION</span>
        <h1>
          A city
          <br />
          <span>on the move.</span>
        </h1>
        <p>Choose a line, then tap a station on the map or use the picker.</p>
      </div>
      <label className="field-label" htmlFor="line-select">
        MTR line
      </label>
      <select
        id="line-select"
        className="station-select"
        value={selection.line}
        onChange={(event) => {
          const next = mtrLines.find((line) => line.code === event.target.value)!;
          onSelect({
            line: next.code,
            station: next.stations.includes(selection.station)
              ? selection.station
              : next.stations[0],
          });
        }}
      >
        {mtrLines.map((line) => (
          <option key={line.code} value={line.code}>
            {line.name}
          </option>
        ))}
      </select>
      <label className="field-label" htmlFor="station-select">
        Station
      </label>
      <select
        id="station-select"
        className="station-select"
        value={selection.station}
        onChange={(event) => onSelect({ ...selection, station: event.target.value })}
      >
        {line.stations.map((code) => (
          <option key={code} value={code}>
            {mtrStations[code].name} · {mtrStations[code].nameZh}
          </option>
        ))}
      </select>
      <div className="station-summary">
        <span className="place-symbol station" style={{ color: line.color }}>
          <TrainFront size={24} />
        </span>
        <div>
          <h2>{station.name}</h2>
          <p>
            {line.name} <span>港鐵</span>
          </p>
        </div>
        <ArrowUpRight size={19} />
      </div>
      {
        <div className="source-card train-motion-card">
          <label>
            <input
              type="checkbox"
              checked={animation}
              onChange={(e) => onAnimation(e.target.checked)}
            />{' '}
            Mini trains · estimated positions
          </label>
          <p>Arrival illustrations, not GPS tracking. Tap a little train for its station times.</p>
          <details>
            <summary>How positions are estimated</summary>
            <p>
              Watch approaching services across the selected line. Timing illustration uses 40 km/h
              plus a 20-second approach allowance, not GPS. Trains appear only within that approach
              window and pause for eight seconds at the station before fading. These are separate
              arrival illustrations, not a tracked fleet; stale, delayed or ambiguous branch reports
              hide them.
            </p>
            <p>
              At an originating terminal, the illustration pauses before the listed time, then
              departs along the first segment. Branch merges without a known incoming route are
              hidden. Motion respects reduced-motion settings; Eco uses fewer updates.
            </p>
          </details>
          {pickedTrain && feed?.data?.some((a) => a.id === pickedTrain.id) && (
            <strong>
              {pickedTrain.destination} · {hkTime(pickedTrain.time)} · Platform{' '}
              {pickedTrain.platform}
            </strong>
          )}
        </div>
      }
      <div className="results-heading">
        <h2>Next trains</h2>
        <span>HKT</span>
      </div>
      <div className="arrival-list">
        {query.isPending ? (
          <p className="loading-text">Checking train times…</p>
        ) : feed?.data?.length ? (
          feed.data.slice(0, 8).map((arrival) => (
            <article className="arrival-row" key={arrival.id}>
              <span className="line-indicator" style={{ background: line.color }} />
              <div>
                <strong>{arrival.destination}</strong>
                <span>
                  Platform {arrival.platform || '—'}
                  {arrival.remark ? ` · ${arrival.remark}` : ''}
                </span>
              </div>
              <time dateTime={arrival.time}>{hkTime(arrival.time)}</time>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <TrainFront size={28} />
            <h3>{feed?.status === 'fresh' ? 'No trains returned' : 'Train times unavailable'}</h3>
            <p>
              {feed?.status === 'fresh'
                ? 'The source has no listed departures for this station right now.'
                : 'We could not get a current response. Please check the operator for service information.'}
            </p>
          </div>
        )}
      </div>
      <div className="source-card">
        <span className={`status-label ${feed?.status === 'fresh' ? 'fresh' : ''}`}>
          <span />
          {feed?.mode === 'fixture'
            ? 'Recorded test snapshot'
            : feed?.status === 'fresh'
              ? 'MTR source connected'
              : 'Current service not confirmed'}
        </span>
        <p>
          Source time: {hkSourceTime(feed?.sourceUpdatedAt)}. Train times are supplied by MTR; East
          Rail may report arrivals or departures.
        </p>
        <button
          className="text-button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} />
          Refresh train times
        </button>
      </div>
      <p className="catalog-note">
        Map dots show stations. Mini trains are estimated arrival illustrations, not tracked
        vehicles. Station locations: Lands Department. Rail alignment: OpenStreetMap. Heavy-rail
        Next Train coverage. Light Rail and High Speed Rail use separate services.
      </p>
    </>
  );
}
