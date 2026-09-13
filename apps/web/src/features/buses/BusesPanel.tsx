import { NearbyStops, type BusSearchArea } from './NearbyStops';
import { useState } from 'react';
import { BusFront, RefreshCw } from 'lucide-react';
import type { BusExplorer } from './use-buses';
import { hkSourceTime, hkTime } from '../../shared/format';

const key = (r: { route: string; bound: string; service: string }) =>
  `${r.route}/${r.bound}/${r.service}`;
export function BusesPanel({
  bus,
  area,
  onSearchArea,
}: {
  bus: BusExplorer;
  area: BusSearchArea;
  onSearchArea: () => void;
}) {
  const citybus = bus.operator === 'citybus';
  const [search, setSearch] = useState('');
  const all = bus.routes.data?.data ?? [];
  const matches = all.filter((r) =>
    [r.route, r.origin, r.originZh, r.destination, r.destinationZh]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  const selectedRoute = all.find((r) => key(r) === key(bus.selection));
  const options = [
    ...new Map(
      [...(selectedRoute ? [selectedRoute] : []), ...matches.slice(0, 80)].map((r) => [key(r), r]),
    ).values(),
  ];
  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">{citybus ? 'CITYBUS' : 'KMB / LONG WIN'}</span>
        <h1>
          Your next
          <br />
          <span>bus ride.</span>
        </h1>
        <p>
          {citybus
            ? 'Choose a direction, then a stop.'
            : 'Choose a direction and service, then a stop.'}{' '}
          Tap a map dot to change stops.
        </p>
      </div>
      <label className="field-label" htmlFor="bus-operator">
        Bus operator
      </label>
      <select
        id="bus-operator"
        className="station-select"
        value={bus.operator}
        onChange={(e) => {
          bus.setOperator(e.target.value as 'kmb' | 'citybus');
          setSearch('');
        }}
      >
        <option value="kmb">KMB / Long Win</option>
        <option value="citybus">Citybus</option>
      </select>
      <NearbyStops
        key={bus.operator}
        operator={bus.operator}
        area={area}
        onSearch={onSearchArea}
        routes={all}
        onSelect={(route) => bus.setSelection(route)}
      />
      <label className="field-label" htmlFor="bus-search">
        Find a route or destination
      </label>
      <input
        id="bus-search"
        className="station-select"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="1A, Sha Tin, 沙田…"
      />
      <label className="field-label" htmlFor="bus-route">
        {citybus ? 'Route and direction' : 'Route, direction and service'}
      </label>
      <select
        id="bus-route"
        className="station-select"
        value={key(bus.selection)}
        disabled={!all.length}
        onChange={(e) => {
          const r = all.find((r) => key(r) === e.target.value);
          if (r) bus.setSelection({ ...r, seq: 1 });
        }}
      >
        {!all.length && (
          <option>{bus.routes.isFetching ? 'Loading routes…' : 'Routes unavailable'}</option>
        )}
        {options.map((r) => (
          <option key={key(r)} value={key(r)}>
            {r.route} · {r.origin} → {r.destination} · {r.bound === 'O' ? 'Outbound' : 'Inbound'}
            {!citybus && ` · Service ${r.service}`}
          </option>
        ))}
      </select>
      <p className="catalog-note">
        {all.length
          ? `${matches.length} matching ${citybus ? 'direction choices' : 'route variants'}. Showing up to 80 plus your selection.`
          : bus.routes.isFetching
            ? 'Loading the route catalogue…'
            : 'Route catalogue unavailable.'}
      </p>
      {!all.length && (
        <button className="text-button" onClick={() => void bus.routes.refetch()}>
          Retry routes
        </button>
      )}
      {selectedRoute && (
        <div className="station-summary">
          <span className="place-symbol station">
            <BusFront size={24} />
          </span>
          <div>
            <h2>
              {selectedRoute.route} · {selectedRoute.destination}
            </h2>
            <p>
              {selectedRoute.destinationZh}
              {!citybus && ` · Service ${selectedRoute.service}`}
            </p>
          </div>
        </div>
      )}
      <label className="field-label" htmlFor="bus-stop">
        Bus stop
      </label>
      <select
        id="bus-stop"
        className="station-select"
        value={bus.selection.seq}
        disabled={!bus.stopFeed?.data?.length}
        onChange={(e) => bus.setSelection({ ...bus.selection, seq: Number(e.target.value) })}
      >
        {!bus.stopFeed?.data?.length && (
          <option>
            {bus.stops.isFetching
              ? 'Loading stops…'
              : bus.stopFeed?.status === 'fresh'
                ? 'No stops supplied for this direction'
                : 'Stops unavailable'}
          </option>
        )}
        {bus.stopFeed?.data?.map((s) => (
          <option key={s.seq} value={s.seq}>
            {s.seq}. {s.name} · {s.nameZh}
          </option>
        ))}
      </select>
      {!bus.stopFeed?.data?.length && !bus.stops.isFetching && (
        <button className="text-button" onClick={() => void bus.stops.refetch()}>
          Retry stops
        </button>
      )}
      <div className="results-heading">
        <h2>Next buses</h2>
        <span>HKT</span>
      </div>
      <div className="arrival-list">
        {!bus.selected ? (
          <p className="loading-text">Select an available stop to check arrivals.</p>
        ) : bus.arrivals.isFetching && !bus.feed ? (
          <p className="loading-text">Checking bus times…</p>
        ) : bus.feed?.data?.length ? (
          bus.feed.data.map((a) => (
            <article className="arrival-row" key={a.id}>
              <span className="line-indicator" style={{ background: '#b96e42' }} />
              <div>
                <strong>{a.time ? hkTime(a.time) : 'No ETA supplied'}</strong>
                <span>
                  {a.remark || 'Estimated arrival'}
                  {a.remarkZh ? ` · ${a.remarkZh}` : ''}
                </span>
              </div>
            </article>
          ))
        ) : (
          <p className="loading-text">
            {bus.feed?.status === 'fresh'
              ? 'No arrival estimates returned for this stop.'
              : 'Current bus times unavailable.'}
          </p>
        )}
      </div>
      <div className="source-card">
        <span className={`status-label ${bus.feed?.status === 'fresh' ? 'fresh' : ''}`}>
          <span />
          {bus.feed?.status === 'fresh'
            ? `${citybus ? 'Citybus' : 'KMB'} source connected`
            : bus.feed?.status === 'stale'
              ? 'Last bus report'
              : 'Current service not confirmed'}
        </span>
        <p>
          Source time: {hkSourceTime(bus.feed?.sourceUpdatedAt)}. Scheduled departures retain the
          provider’s “Scheduled Bus” remark.
        </p>
        <button
          className="text-button"
          disabled={!bus.selected || bus.arrivals.isFetching}
          onClick={() => void bus.arrivals.refetch()}
        >
          <RefreshCw size={14} />
          Refresh bus times
        </button>
      </div>
      <p className="catalog-note">
        {bus.routes.data?.mode === 'fixture' ? 'Fixture mode · no bus recording configured. ' : ''}
        Dots are stops, not moving buses.{' '}
        {citybus
          ? 'Some routes provide stops in only one direction. Empty directions do not confirm a service suspension.'
          : 'Service numbers identify variants, not frequency.'}{' '}
        Catalogue fetched: {hkSourceTime(bus.routes.data?.fetchedAt)}.
      </p>
      <a
        href={
          citybus
            ? 'https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta'
            : 'https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb'
        }
        target="_blank"
        rel="noreferrer"
        className="text-button"
      >
        Official bus data ↗
      </a>
    </>
  );
}
