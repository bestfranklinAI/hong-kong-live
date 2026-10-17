import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@base-ui/react/dialog';
import {
  indoorStationsSchema,
  type IndoorVenue,
  type WalkingRoute,
  type StationRouteContext,
  type Place,
  type RouteEndpoint,
} from '@hk/contracts';
import { getJson } from '../live/queries';
import { IndoorVenueBrowser } from './IndoorVenueBrowser';
import { StationFloorPlan } from './StationFloorPlan';
import './walking.css';
import { useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { ArrowLeft, X } from 'lucide-react';

export function StationIndoorDialog({
  place,
  venue,
  open,
  onClose,
  onRoutePoint,
  stationRoute,
  routeRole,
  onContinueRoute,
  journeyViews,
  routeForVenue,
  initialLevel,
  onLevelChange,
}: {
  routeForVenue?: WalkingRoute;
  initialLevel?: string;
  onLevelChange?: (id: string) => void;
  journeyViews?: ReactNode;
  onContinueRoute?: () => void;
  routeRole?: 'start' | 'end';
  stationRoute?: { route: WalkingRoute; context: StationRouteContext };
  venue?: IndoorVenue;
  place?: Pick<Place, 'name' | 'nameZh'>;
  open: boolean;
  onClose: () => void;
  onRoutePoint?: (point: RouteEndpoint, role: 'start' | 'end') => void;
}) {
  const [selectedVenue, setSelectedVenue] = useState<IndoorVenue | undefined>(venue);
  const [browsing, setBrowsing] = useState(!place && !venue);
  const drag = useRef<{ x: number; y: number; at: number } | null>(null);
  const finishDrag = (event: PointerEvent<HTMLElement>, cancel = false) => {
    const start = drag.current;
    drag.current = null;
    const popup = event.currentTarget.closest<HTMLElement>('.station-indoor-dialog');
    popup?.removeAttribute('data-dragging');
    popup?.style.removeProperty('--indoor-drag');
    if (!start || cancel) return;
    const dy = event.clientY - start.y;
    if (
      dy > Math.abs(event.clientX - start.x) * 1.3 &&
      (dy > 90 || (dy > 28 && dy / Math.max(1, performance.now() - start.at) > 0.5))
    )
      onClose();
  };
  const catalogue = useQuery({
    queryKey: ['indoor-stations'],
    enabled: open && !!place && !browsing,
    queryFn: async ({ signal }) =>
      indoorStationsSchema.parse(await getJson('/api/v1/routes/indoor/stations', signal)),
    staleTime: 21600000,
    retry: 1,
  });
  // Match names exactly after removing station suffixes; never guess the nearest venue.
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/\bmtr\b|\bstation\b|港鐵|站/g, '')
      .replace(/\s+/g, '')
      .trim();
  const matches = place
    ? catalogue.data?.stations.filter(
        (s) =>
          normalize(s.name) === normalize(place.name) ||
          normalize(s.nameZh) === normalize(place.nameZh),
      )
    : undefined;
  const station: IndoorVenue | undefined =
    selectedVenue ?? (matches?.length === 1 ? { ...matches[0], kind: 'station' } : undefined);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="about-dialog station-indoor-dialog">
          <div
            className="indoor-sheet-header"
            onPointerDown={(event) => {
              if (
                !window.matchMedia('(max-width: 700px)').matches ||
                (event.target as Element).closest('button')
              )
                return;
              // Track the finger directly; animate only when the sheet returns to rest.
              event.currentTarget
                .closest<HTMLElement>('.station-indoor-dialog')
                ?.setAttribute('data-dragging', 'true');
              drag.current = { x: event.clientX, y: event.clientY, at: performance.now() };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (drag.current)
                event.currentTarget
                  .closest<HTMLElement>('.station-indoor-dialog')
                  ?.style.setProperty(
                    '--indoor-drag',
                    `${Math.max(0, event.clientY - drag.current.y)}px`,
                  );
            }}
            onPointerUp={finishDrag}
            onPointerCancel={(event) => finishDrag(event, true)}
          >
            <span className="indoor-drag-handle" aria-hidden="true" />
            <div>
              <small>Indoor map</small>
              <Dialog.Title>
                {browsing ? 'Indoor maps' : (station?.name ?? place?.name ?? 'Indoor map')}
              </Dialog.Title>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close indoor map">
              <X size={22} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Choose a floor. Zoom and pan the plan, then tap a mapped feature.
          </Dialog.Description>
          <div className="indoor-sheet-content" role="region" aria-label="Indoor map content">
            {browsing ? (
              <IndoorVenueBrowser
                onSelect={(venue) => {
                  setSelectedVenue(venue);
                  setBrowsing(false);
                }}
              />
            ) : (
              <>
                <button
                  className="text-button indoor-browse-back"
                  onClick={() => setBrowsing(true)}
                >
                  <ArrowLeft size={16} /> All indoor maps
                </button>
                {catalogue.isFetching && !station && <p role="status">Finding indoor map…</p>}
                {catalogue.isError && !station && (
                  <p role="alert">
                    Indoor catalogue unavailable.{' '}
                    <button className="text-button" onClick={() => void catalogue.refetch()}>
                      Retry
                    </button>
                  </p>
                )}
                {catalogue.isSuccess && !station && <p>No matching indoor map is available.</p>}
                {station && (
                  <StationFloorPlan
                    key={`${station.kind}:${station.id}`}
                    journeyViews={journeyViews}
                    routeForVenue={routeForVenue}
                    initialLevel={initialLevel}
                    onLevelChange={onLevelChange}
                    station={station}
                    kind={station.kind}
                    onDismiss={onClose}
                    stationRoute={
                      stationRoute?.context.venue.id === station.id ? stationRoute : undefined
                    }
                    onContinueRoute={onContinueRoute}
                    routeRole={routeRole}
                    onRoutePoint={onRoutePoint}
                  />
                )}
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
