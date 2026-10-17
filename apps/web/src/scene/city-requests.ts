import { RequestScheduler } from 'cesium';

const SERVER = 'data.map.gov.hk:443';
const leases = new Map<string, { users: number; previous: number | undefined; applied: number }>();

/** Keep requests in Cesium's priority queue rather than flooding the provider/browser queue. */
export function limitCityRequests(source?: string): () => void {
  let url: URL;
  try {
    url = new URL(source ?? '');
  } catch {
    return () => {};
  }
  if (url.origin !== 'https://data.map.gov.hk' || !url.pathname.startsWith('/api/3d-data/'))
    return () => {};
  let lease = leases.get(SERVER);
  if (!lease) {
    const previous = RequestScheduler.requestsByServer[SERVER];
    lease = {
      users: 0,
      previous,
      applied: Math.min(6, previous ?? RequestScheduler.maximumRequestsPerServer),
    };
    leases.set(SERVER, lease);
    RequestScheduler.requestsByServer[SERVER] = lease.applied;
  }
  lease.users++;
  const current = lease;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--current.users !== 0) return;
    // Another renderer may have deliberately changed this shared Cesium setting.
    if (RequestScheduler.requestsByServer[SERVER] === current.applied) {
      if (current.previous === undefined) delete RequestScheduler.requestsByServer[SERVER];
      else RequestScheduler.requestsByServer[SERVER] = current.previous;
    }
    leases.delete(SERVER);
  };
}
