// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RouteServiceNotes } from './RouteServiceNotes';

it('explains actual traversed preferences without claiming a fare or an unavoidable route', () => {
  const message =
    'Network elements with avoid-restrictions are traversed in the output (restriction attribute names: "Avoid Paid Area (high)" "Avoid Staircase (high)" "Avoid Outdoor (high)").';
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(RouteServiceNotes, { messages: [message] }));
  expect(host.querySelector('summary')?.textContent).toBe(
    'Route includes stairs, outdoor sections, and paid-area links',
  );
  expect(host.textContent).toContain('preferences, not absolute bans');
  expect(host.textContent).toContain('does not tell us whether you must pay');
  expect(host.textContent).not.toContain('unavoidable');
  expect(host.querySelector('details details')?.textContent).toContain(message);
  expect(host.querySelector('details details')?.hasAttribute('open')).toBe(false);
});
it('does not invent translations for unknown constraints and prioritises ignored requests', () => {
  const unknown = renderToStaticMarkup(
    createElement(RouteServiceNotes, { messages: ['avoid-restrictions: "Avoid Unknown (high)"'] }),
  );
  expect(unknown).toContain('Some route preferences could not be met');
  expect(unknown).not.toContain('Route includes');
  const ignored = renderToStaticMarkup(
    createElement(RouteServiceNotes, { messages: ['The restriction was not valid and ignored.'] }),
  );
  expect(ignored).toContain('Some route options were not applied');
  expect(ignored).not.toContain('Route includes');
});
