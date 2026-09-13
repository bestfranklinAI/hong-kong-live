import { describe, expect, it } from 'vitest';
import { parseSearch } from './search-state';

describe('shareable view state', () => {
  it('accepts an existing place and supported mode', () => {
    expect(parseSearch({ mode: 'weather', place: 'victoria-peak' })).toEqual({
      mode: 'weather',
      place: 'victoria-peak',
    });
  });
  it('safely discards malformed or unknown URL state', () => {
    expect(parseSearch({ mode: ['transport'], place: 'unknown', key: 'ignored' })).toEqual({
      mode: 'explore',
    });
  });
  it('retains bilingual search and category across mode changes', () => {
    expect(parseSearch({ mode: 'transport', q: '西九 art', category: 'park' })).toEqual({
      mode: 'transport',
      q: '西九 art',
      category: 'park',
    });
  });
});

it('preserves a valid line and station together and discards invalid pairs', () => {
  expect(parseSearch({ mode: 'transport', line: 'EAL', station: 'SHT' })).toMatchObject({
    line: 'EAL',
    station: 'SHT',
  });
  expect(parseSearch({ mode: 'transport', line: 'ISL', station: 'SHT' })).toEqual({
    mode: 'transport',
  });
  expect(parseSearch({ mode: 'transport', line: 'EAL' })).toEqual({ mode: 'transport' });
});
