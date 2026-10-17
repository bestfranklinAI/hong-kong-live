// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { StationFloorPlan } from './StationFloorPlan';
import building from '../../../../../fixtures/providers/landsd-building-sample-2026-10-17.json';
import journey from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import {
  normalizeIndoorFloors,
  normalizeIndoorPoints,
} from '../../../../../packages/providers/src/indoor';
import { walkingRouteSchema } from '@hk/contracts';
it('opens a building on the route-matched floor rather than the first default floor', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const venue = building.venue.features[0].properties;
  const floor = normalizeIndoorFloors(building.floors, venue.venue_id)[0];
  const other = {
    ...floor,
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Ground',
    z: 104.53,
    polygons: floor.polygons.map((polygon) =>
      polygon.map((ring) => ring.map(([x, y]) => [x, y, 104.53])),
    ),
  };
  // A test route on a captured boundary verifies display matching, not real pedestrian access.
  const route = walkingRouteSchema.parse({
    ...journey.route,
    paths: [[floor.polygons[0][0][0], floor.polygons[0][0][1]]],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith('/floors')
              ? { floors: [other, floor], fetchedAt: '2026-10-17T00:00:00Z', sourceUpdatedAt: null }
              : url.endsWith('/points')
                ? {
                    points: normalizeIndoorPoints(building.points, venue.venue_id),
                    fetchedAt: '2026-10-17T00:00:00Z',
                    sourceUpdatedAt: null,
                  }
                : {
                    units: [],
                    openings: [],
                    fetchedAt: '2026-10-17T00:00:00Z',
                    sourceUpdatedAt: null,
                  },
          ),
        ),
    ),
  );
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(StationFloorPlan, {
            station: { id: venue.venue_id, name: venue.venue_name_en },
            kind: 'building',
            routeForVenue: route,
          }),
        ),
      ),
    );
    await vi.waitFor(() =>
      expect(container.querySelector<HTMLSelectElement>('select')?.value).toBe(floor.id),
    );
    expect(container.querySelector('[aria-label*="highlighted route"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  }
});
