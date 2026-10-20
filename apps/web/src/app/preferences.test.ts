// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { usePreferences } from './preferences';

const initial = usePreferences.getState();
afterEach(() => {
  usePreferences.setState(initial, true);
  localStorage.removeItem('hk-live-preferences');
});

it('stores profile and language preferences without journey coordinates or route data', () => {
  usePreferences.getState().setWalkingProfile('barrier-free');
  usePreferences.getState().setDirectionsLanguage('zh-HK');
  const saved = JSON.parse(localStorage.getItem('hk-live-preferences')!);
  expect(saved.state.walkingProfile).toBe('barrier-free');
  expect(saved.state.directionsLanguage).toBe('zh-HK');
  expect(saved.state).not.toHaveProperty('route');
  expect(saved.state).not.toHaveProperty('start');
  const restored = usePreferences.persist.getOptions().merge!(saved.state, initial);
  expect(restored.walkingProfile).toBe('barrier-free');
  expect(restored.directionsLanguage).toBe('zh-HK');
});

it('validates stored route choices and remains compatible with older preferences', () => {
  const merge = usePreferences.persist.getOptions().merge!;
  for (const saved of [
    {},
    { walkingProfile: 'rainproof', directionsLanguage: 'unknown', setWalkingProfile: null },
  ]) {
    const restored = merge(saved, initial);
    expect(restored.walkingProfile).toBe('recommended');
    expect(restored.directionsLanguage).toBe('en');
    expect(typeof restored.setWalkingProfile).toBe('function');
  }
});
