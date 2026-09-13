import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  feedSchema,
  busStopsSchema,
  nearbyBusStopsSchema,
  reportedBusRoutesSchema,
  type BusRoute,
  type ReportedBusRoute,
} from '@hk/contracts';
import { getJson, useDisplayTime } from '../live/queries';
import { displayFeed } from '../live/display-feed';

export type BusSearchArea = { lng: number; lat: number; revision?: number } | null | undefined;
export function NearbyStops({
  operator,
  area,
  onSearch,
  routes,
  onSelect,
}: {
  operator: 'kmb' | 'citybus';
  area: BusSearchArea;
  onSearch: () => void;
  routes: BusRoute[];
  onSelect: (route: ReportedBusRoute) => void;
}) {
  const citybus = operator === 'citybus';
  const confirmation = useRef<AbortController | null>(null);
  useEffect(() => () => confirmation.current?.abort(), []);
  const [checking, setChecking] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [stopId, setStopId] = useState<string>();
  const [open, setOpen] = useState(true);
  const now = useDisplayTime();
  const nearby = useQuery({
    queryKey: ['nearby-buses', operator, area?.lng, area?.lat, area?.revision],
    enabled: Boolean(area),
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      feedSchema(nearbyBusStopsSchema).parse(
        await getJson(`/api/v1/buses/${operator}/nearby?lng=${area!.lng}&lat=${area!.lat}`, signal),
      ),
  });
  const feed = displayFeed(
    nearby.data,
    nearby.isError,
    now,
    citybus ? Infinity : 86400_000,
    3600_000,
  );
  const selected = feed?.data?.find((s) => s.id === stopId);
  const reported = useQuery({
    queryKey: ['bus-reported-routes', operator, selected?.id],
    enabled: Boolean(selected) && open,
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      feedSchema(reportedBusRoutesSchema).parse(
        await getJson(`/api/v1/buses/${operator}/reported-routes?stop=${selected!.id}`, signal),
      ),
  });
  const report = displayFeed(
    reported.data,
    reported.isError,
    now,
    citybus ? Infinity : 120_000,
    60_000,
  );
  const expired =
    !citybus && report?.sourceUpdatedAt && now - Date.parse(report.sourceUpdatedAt) >= 180_000;
  const choices = expired
    ? []
    : (report?.data?.flatMap((r) => {
        const route = routes.find(
          (v) => v.route === r.route && v.bound === r.bound && v.service === r.service,
        );
        return route ? [{ ...route, seq: r.seq }] : [];
      }) ?? []);
  return (
    <section className="nearby-stops" aria-label="Find nearby bus stops">
      <button
        className="text-button"
        disabled={checking}
        onClick={() => {
          setStopId(undefined);
          setSelectionError('');
          setOpen(true);
          onSearch();
        }}
      >
        Search this map area
      </button>
      <p className="catalog-note">
        Move the map first. Up to 20 stops within 800 m of its centre. Distances are straight-line,
        not walking routes. Search again after moving the map to update results.
      </p>
      {citybus && feed && (
        <p className="catalog-note">
          Discovery snapshot: {new Date(feed.fetchedAt).toLocaleDateString('en-HK')}. Routes and
          stops may have changed; arrivals are checked live after selection.
        </p>
      )}
      {area === null && <p role="status">Point the map at the ground, then try again.</p>}
      {area && (
        <>
          <button className="text-button" onClick={() => setOpen(!open)}>
            {open ? 'Hide nearby stops' : 'Show nearby stops'}
          </button>
          {open && (
            <>
              {nearby.isFetching ? (
                <p role="status">Finding nearby stops…</p>
              ) : !feed?.data ? (
                <p role="status">
                  Nearby stops unavailable. Move the map within Hong Kong and try again.
                </p>
              ) : !feed.data.length ? (
                <p role="status">
                  No {citybus ? 'indexed Citybus' : 'KMB / Long Win'} stops found within 800 m.
                </p>
              ) : (
                <div className="nearby-stop-list">
                  {feed.data.map((s) => (
                    <button
                      className="nearby-stop"
                      key={s.id}
                      aria-pressed={selected?.id === s.id}
                      disabled={checking}
                      onClick={() => {
                        setStopId(s.id);
                        setSelectionError('');
                      }}
                    >
                      <strong>{s.name}</strong>
                      <span>
                        {s.nameZh} · {s.distance} m
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selected && (
                <div className="nearby-routes">
                  <h3>
                    {citybus ? 'Routes indexed at this stop' : 'Reported routes at this stop'}
                  </h3>
                  <p>{selected.nameZh}</p>
                  {reported.isFetching ? (
                    <p role="status">Checking routes…</p>
                  ) : choices.length ? (
                    choices.map((r) => (
                      <button
                        className="nearby-stop"
                        key={`${r.route}/${r.bound}/${r.service}/${r.seq}`}
                        disabled={checking}
                        onClick={async () => {
                          if (!citybus) {
                            onSelect(r);
                            setOpen(false);
                            return;
                          }
                          setChecking(true);
                          setSelectionError('');
                          const controller = new AbortController();
                          confirmation.current = controller;
                          try {
                            const params = new URLSearchParams({
                              route: r.route,
                              bound: r.bound,
                              service: r.service,
                            });
                            const current = feedSchema(busStopsSchema).parse(
                              await getJson(
                                `/api/v1/buses/citybus/stops?${params}`,
                                AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
                              ),
                            );
                            if (
                              current.status !== 'fresh' ||
                              !current.data?.some((s) => s.id === selected.id && s.seq === r.seq)
                            )
                              throw new Error('Changed stop');
                            if (controller.signal.aborted) return;
                            onSelect(r);
                            setOpen(false);
                          } catch {
                            setSelectionError(
                              'This stop could not be confirmed on the current route. Try route search below.',
                            );
                          } finally {
                            setChecking(false);
                          }
                        }}
                      >
                        <strong>
                          {r.route} → {r.destination}
                        </strong>
                        <span>
                          {r.destinationZh}
                          {!citybus && ` · Service ${r.service}`} · Stop {r.seq}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p>
                      No current route information returned. Use route search below; this does not
                      confirm that service has ended.
                    </p>
                  )}
                  {checking && <p role="status">Confirming the current route stops…</p>}
                  {selectionError && <p role="status">{selectionError}</p>}
                  <button
                    className="text-button"
                    disabled={reported.isFetching}
                    onClick={() => void reported.refetch()}
                  >
                    {citybus ? 'Refresh indexed routes' : 'Refresh reported routes'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
