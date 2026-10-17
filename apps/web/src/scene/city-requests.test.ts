import { afterEach, expect, it } from 'vitest';
import { RequestScheduler } from 'cesium';
import { limitCityRequests } from './city-requests';

const server = 'data.map.gov.hk:443';
const original = RequestScheduler.requestsByServer[server];
const releases: Array<() => void> = [];
afterEach(() => {
  releases.splice(0).forEach((release) => release());
  if (original === undefined) delete RequestScheduler.requestsByServer[server];
  else RequestScheduler.requestsByServer[server] = original;
});
function acquire(source = 'https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json') {
  const release = limitCityRequests(source);
  releases.push(release);
  return release;
}

it('retains the budget across overlapping renderer lifetimes and restores the original setting', () => {
  delete RequestScheduler.requestsByServer[server];
  const first = acquire();
  const second = acquire();
  expect(RequestScheduler.requestsByServer[server]).toBe(6);
  first();
  first();
  expect(RequestScheduler.requestsByServer[server]).toBe(6);
  second();
  expect(Object.hasOwn(RequestScheduler.requestsByServer, server)).toBe(false);
});

it('respects a stricter pre-existing limit and does not overwrite a later owner', () => {
  RequestScheduler.requestsByServer[server] = 3;
  const first = acquire();
  expect(RequestScheduler.requestsByServer[server]).toBe(3);
  first();
  expect(RequestScheduler.requestsByServer[server]).toBe(3);
  const second = acquire();
  RequestScheduler.requestsByServer[server] = 2;
  second();
  expect(RequestScheduler.requestsByServer[server]).toBe(2);
});

it('leaves other tile servers and unrelated LandsD services alone', () => {
  delete RequestScheduler.requestsByServer[server];
  acquire('https://example.com/tileset.json');
  acquire('https://data.map.gov.hk/another-service');
  acquire('invalid URL');
  expect(Object.hasOwn(RequestScheduler.requestsByServer, server)).toBe(false);
});
