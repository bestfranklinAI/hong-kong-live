import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@base-ui/react/dialog';
import { indoorStationsSchema, type Place, type RouteEndpoint } from '@hk/contracts';
import { getJson } from '../live/queries';
import { StationFloorPlan } from './StationFloorPlan';
import './walking.css';

export function StationIndoorDialog({
  place,
  open,
  onClose,
  onRoutePoint,
}: {
  place: Place;
  open: boolean;
  onClose: () => void;
  onRoutePoint: (point: RouteEndpoint, role: 'start' | 'end') => void;
}) {
  const catalogue = useQuery({
    queryKey: ['indoor-stations'],
    enabled: open,
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
  const matches = catalogue.data?.stations.filter(
    (s) =>
      normalize(s.name) === normalize(place.name) ||
      normalize(s.nameZh) === normalize(place.nameZh),
  );
  const station = matches?.length === 1 ? matches[0] : undefined;
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
          <div className="dialog-top">
            <Dialog.Title>{place.name} · Indoor map</Dialog.Title>
            <Dialog.Close className="text-button">Close indoor map</Dialog.Close>
          </div>
          <Dialog.Description>
            Choose a floor, then tap a mapped point for directions.
          </Dialog.Description>
          {catalogue.isPending && <p role="status">Finding the official station map…</p>}
          {catalogue.isError && (
            <p role="alert">
              Station catalogue unavailable.{' '}
              <button onClick={() => void catalogue.refetch()}>Retry</button>
            </p>
          )}
          {catalogue.isSuccess && !station && (
            <p>No matching indoor map is available for this station.</p>
          )}
          {station && (
            <StationFloorPlan key={station.id} station={station} onRoutePoint={onRoutePoint} />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
