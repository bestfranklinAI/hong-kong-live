import { describe, expect, it } from 'vitest';
import weather from '../../../fixtures/providers/hko-2026-09-13.json';
import arrivals from '../../../fixtures/providers/mtr-isl-adm-2026-09-13.json';
import { normalizeArrivals, stationQuerySchema } from './mtr';
import { normalizeWeather } from './weather';
import { parseSourceTime } from './time';

const query = { line: 'ISL', station: 'ADM' };

describe('source time normalization', () => {
  it('interprets MTR midnight as Hong Kong time rather than the host time zone', () => {
    expect(parseSourceTime('2026-09-14 00:03:00')).toBe('2026-09-13T16:03:00.000Z');
    expect(parseSourceTime('2026-09-14T00:03:00+08:00')).toBe('2026-09-13T16:03:00.000Z');
  });

  it('leaves absent and ambiguous dates unknown', () => {
    expect(parseSourceTime(undefined)).toBeNull();
    expect(parseSourceTime('09/13/2026')).toBeNull();
    expect(parseSourceTime('2026-09-13T14:00:00')).toBeNull();
    expect(parseSourceTime('2026-02-30 14:00:00')).toBeNull();
  });
});

describe('HKO current observations', () => {
  it('uses the named reference station and oldest measurement timestamp', () => {
    const report = normalizeWeather(weather);
    expect(report.data.temperature).toBe(31);
    expect(report.data.humidity).toBe(67);
    expect(report.data.condition).toBe('Sunny intervals');
    expect(report.sourceUpdatedAt).toBe(parseSourceTime(weather.temperature.recordTime));
    expect(report.data.iconUpdatedAt).toBe(parseSourceTime(weather.iconUpdateTime));
  });

  it('does not replace missing observations with zeros or a different station', () => {
    expect(() =>
      normalizeWeather({ ...weather, temperature: { ...weather.temperature, data: [] } }),
    ).toThrow();
    const noHumidity = normalizeWeather({ ...weather, humidity: undefined });
    expect(noHumidity.data.humidity).toBeNull();
  });

  it('does not treat report publication as an unknown observation time', () => {
    const report = normalizeWeather({
      ...weather,
      temperature: { data: weather.temperature.data },
    });
    expect(report.sourceUpdatedAt).toBeNull();
  });

  it('does not let an old icon suppress newer measurements', () => {
    const report = normalizeWeather({ ...weather, iconUpdateTime: '2026-09-12T01:00:00+08:00' });
    expect(report.sourceUpdatedAt).toBe(parseSourceTime(weather.temperature.recordTime));
    expect(report.data.iconUpdatedAt).toBe('2026-09-11T17:00:00.000Z');
    expect(report.data.temperature).toBe(31);
  });

  it('rejects malformed provider data', () => {
    expect(() => normalizeWeather({ temperature: 'hot' })).toThrow('format has changed');
  });
});

describe('MTR departure adapter', () => {
  it('keeps both directions, platform numbers and absolute departure times', () => {
    const result = normalizeArrivals(arrivals, query);
    expect(result.data).toHaveLength(8);
    expect(result.data[0]).toMatchObject({
      destination: 'Chai Wan',
      platform: '3',
      time: '2026-09-13T06:19:44.000Z',
    });
    expect(new Set(result.data.map((train) => train.id)).size).toBe(8);
    expect(result.sourceUpdatedAt).toBe('2026-09-13T06:16:44.000Z');
  });

  it('does not turn service errors or missing station data into an empty timetable', () => {
    expect(() => normalizeArrivals({ status: 0, message: 'Service not available' }, query)).toThrow(
      'unavailable',
    );
    expect(() => normalizeArrivals({ status: 1, data: {} }, query)).toThrow('requested station');
  });

  it('allows a successful empty station schedule and excludes invalid predictions', () => {
    const result = normalizeArrivals(
      { status: 1, data: { 'ISL-ADM': { curr_time: '2026-09-13 14:16:44', UP: [] } } },
      query,
    );
    expect(result.data).toEqual([]);
    const invalid = structuredClone(arrivals);
    invalid.data['ISL-ADM'].UP[0].valid = 'N';
    expect(normalizeArrivals(invalid, query).data).toHaveLength(7);
  });

  it('rejects station/line combinations outside explicitly supported coverage', () => {
    expect(stationQuerySchema.safeParse(query).success).toBe(true);
    expect(stationQuerySchema.safeParse({ line: 'ISL', station: 'TST' }).success).toBe(false);
    expect(
      stationQuerySchema.safeParse({ line: 'ISL', station: 'https://example.com' }).success,
    ).toBe(false);
  });
});

it('preserves East Rail arrival semantics and via-Racecourse routing', () => {
  const result = normalizeArrivals(
    {
      status: 1,
      data: {
        'EAL-SHT': {
          curr_time: '2026-09-13 17:00:00',
          UP: [
            {
              seq: 1,
              dest: 'LOW',
              plat: 1,
              time: '2026-09-13 17:01:00',
              valid: 'Y',
              timetype: 'A',
              route: 'RAC',
            },
          ],
        },
      },
    },
    { line: 'EAL', station: 'SHT' },
  );
  expect(result.data[0]).toMatchObject({
    destination: 'Lo Wu',
    platform: '1',
    remark: 'Estimated arrival · Via Racecourse',
  });
});

it('keeps regional metrics with their source station and individual timestamps', async () => {
  const { normalizeRegionalWeather } = await import('./weather');
  const result = normalizeRegionalWeather(weather);
  expect(result.data.length).toBe(27);
  expect(result.data.find((item) => item.station === 'Sha Tin')).toMatchObject({
    temperature: 32,
    humidity: null,
    humidityAt: null,
  });
  expect(result.data.find((item) => item.station === 'Hong Kong Observatory')).toMatchObject({
    humidity: 67,
    temperatureAt: '2026-09-13T06:00:00.000Z',
  });
  const missing = structuredClone(weather);
  missing.temperature.recordTime = 'invalid';
  expect(normalizeRegionalWeather(missing).sourceUpdatedAt).toBeNull();
});
