import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indoorVenuesSchema } from '@hk/contracts';
import { getJson } from '../live/queries';
import { StationIndoorDialog } from './StationIndoorDialog';
/** Only offer a direct shortcut for one exact catalogue match; proximity isn't indoor coverage. */
export function BuildingIndoorButton({ name, nameZh = '' }: { name: string; nameZh?: string }) {
  const [open, setOpen] = useState(false);
  const catalogue = useQuery({
    queryKey: ['indoor-venues', 'building'],
    queryFn: async ({ signal }) =>
      indoorVenuesSchema.parse(await getJson('/api/v1/routes/indoor/buildings', signal)).venues,
    staleTime: 21600000,
    retry: 1,
  });
  const normalize = (text: string) =>
    text.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, '');
  const names = [name, nameZh].filter(Boolean).map(normalize);
  const matches = catalogue.data?.filter((venue) =>
    [venue.name, venue.nameZh].some((value) => value && names.includes(normalize(value))),
  );
  const venue = matches?.length === 1 ? matches[0] : undefined;
  if (!venue) return null;
  return (
    <>
      <button className="walking-submit" onClick={() => setOpen(true)}>
        View indoor map
      </button>
      {open && <StationIndoorDialog venue={venue} open onClose={() => setOpen(false)} />}
    </>
  );
}
