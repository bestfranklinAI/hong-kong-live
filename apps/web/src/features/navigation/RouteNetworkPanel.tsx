import { useId, useState, type KeyboardEvent } from 'react';
import type { WalkingRoute } from '@hk/contracts';
import type { RouteNetworkState } from './use-route-network';
import { networkDrawing } from './network-drawing';
import { networkKindLabel, networkSectionName, type NetworkKind } from './network-labels';

export function RouteNetworkPanel({
  network,
  route,
}: {
  network: RouteNetworkState;
  route: WalkingRoute;
}) {
  const [heights, setHeights] = useState(false);
  const [selected, setSelected] = useState('');
  const hint = useId();
  const data = network.data;
  const selectedIndex = data?.segments.findIndex((s) => s.id === selected) ?? -1;
  const segment = data?.segments[selectedIndex];
  const drawing = data
    ? networkDrawing(data.segments, heights, route.paths).filter((row) => row.d.trim())
    : [];
  const sections = drawing.flatMap((row) => (row.segment ? [row.segment] : []));
  const focusedIndex = sections.findIndex((section) => section.id === selected);
  const sourceHeights =
    segment?.paths.flatMap((path) => path.flatMap((p) => (p[2] === null ? [] : [p[2]]))) ?? [];
  function moveSection(event: KeyboardEvent<SVGGElement>, index: number) {
    if (
      !sections.length ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)
    )
      return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % sections.length;
    if (event.key === 'ArrowLeft') next = (index + sections.length - 1) % sections.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = sections.length - 1;
    setSelected(sections[next].id);
    const targets =
      event.currentTarget.ownerSVGElement?.querySelectorAll<SVGElement>('[data-network-section]');
    targets?.[next]?.focus();
  }
  return (
    <section className="route-network" aria-label="Nearby walkways">
      <label className="network-toggle">
        <input
          type="checkbox"
          checked={network.visible}
          onChange={(e) => network.setVisible(e.target.checked)}
        />
        <span>
          <strong>Show nearby walkways</strong>
          <small>Footbridges, underpasses and level changes</small>
        </span>
      </label>
      {network.visible && (
        <div className="network-content">
          <div className="network-tabs" aria-label="What to show">
            <button
              aria-pressed={network.category === 'connections'}
              onClick={() => network.setCategory('connections')}
            >
              Bridges & lifts
            </button>
            <button
              aria-pressed={network.category === 'cover'}
              onClick={() => network.setCategory('cover')}
            >
              Rain cover
            </button>
          </div>
          {network.category === 'connections' ? (
            <>
              <p>Find footbridges, pedestrian underpasses, lifts, stairs and escalators.</p>
              <label className="network-filter">
                Show on map
                <select
                  value={network.kind}
                  onChange={(e) => network.setKind(e.target.value as NetworkKind)}
                >
                  <option value="all">All types</option>
                  {network.availableKinds.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <p>See which nearby paths are recorded as covered or exposed to rain.</p>
          )}
          <p className="network-caption">
            Nearby paths may be on another floor or outside your route. Access is unverified.
          </p>
          {network.loading && <p role="status">Loading nearby walkways…</p>}
          {network.error && (
            <p role="alert">
              {network.error.message} <button onClick={network.retry}>Try again</button>
            </p>
          )}
          {data && (
            <>
              {data.partial && (
                <p className="search-notice">Limited detail: some nearby paths are omitted.</p>
              )}
              {!data.segments.length ? (
                <p>No matching mapped sections were returned. Coverage may be incomplete.</p>
              ) : (
                <>
                  <div className="network-diagram-heading">
                    <strong>{heights ? 'Height diagram' : 'Walkway overview'}</strong>
                    <button aria-pressed={heights} onClick={() => setHeights(!heights)}>
                      {heights ? 'Map view' : 'Height diagram'}
                    </button>
                  </div>
                  <svg
                    className="network-diagram"
                    viewBox="0 0 360 240"
                    role="group"
                    aria-describedby={hint}
                    aria-label={
                      heights ? 'Nearby walkway height diagram' : 'Nearby walkway overview'
                    }
                  >
                    {drawing.map(({ segment: s, d }, index) =>
                      s ? (
                        <g
                          key={s.id}
                          className="network-section"
                          data-network-section
                          role="button"
                          tabIndex={
                            focusedIndex === index || (focusedIndex === -1 && index === 0) ? 0 : -1
                          }
                          aria-label={`${networkKindLabel(s.kind)} section${networkSectionName(s) ? ` · ${networkSectionName(s)}` : ''} · ${index + 1}`}
                          aria-pressed={selected === s.id}
                          onClick={() => setSelected(s.id)}
                          onKeyDown={(event) => moveSection(event, index)}
                        >
                          <title>
                            {networkKindLabel(s.kind)} · {networkSectionName(s) || 'Mapped section'}
                          </title>
                          <path d={d} className="network-hit" pointerEvents="stroke" />
                          <path
                            d={d}
                            aria-hidden="true"
                            pointerEvents="none"
                            className={`network-line network-line--${data.category === 'cover' ? s.cover : 'connection'}${s.kind === 'Lift' || s.kind === 'Stairlift' ? ' network-line--vertical' : ''}${s.enabled === false ? ' network-line--disabled' : ''}${selected === s.id ? ' network-line--selected' : ''}`}
                          />
                          {!heights && (s.kind === 'Lift' || s.kind === 'Stairlift') && (
                            <circle
                              cx={Number(d.match(/^M([-\d.]+),/)?.[1])}
                              cy={Number(d.match(/^M[-\d.]+,([-\d.]+)/)?.[1])}
                              r={6}
                              pointerEvents="all"
                              className={`network-dot network-dot--${data.category === 'cover' ? s.cover : 'connection'}`}
                            />
                          )}
                        </g>
                      ) : (
                        <path
                          key="route-reference"
                          d={d}
                          className="network-line network-line--route"
                          pointerEvents="none"
                        >
                          <title>Your walking route · horizontal reference</title>
                        </path>
                      ),
                    )}
                  </svg>
                  <p id={hint} className="network-caption">
                    Tap a line or dot in this diagram to see its type and recorded cover.
                    <span className="sr-only">
                      {' '}
                      Keyboard: use arrow keys to move between mapped sections, or Enter to open
                      details.
                    </span>
                  </p>
                  {heights && (
                    <p className="network-caption">
                      Source heights, exaggerated 3×. This diagram does not locate your floor.
                    </p>
                  )}
                  <div className="network-legend">
                    {!heights && <span className="route">Your route</span>}
                    {data.category === 'connections' ? (
                      <span className="connection">Nearby walkways</span>
                    ) : (
                      <>
                        <span className="covered">Covered</span>
                        <span className="uncovered">Exposed</span>
                        <span className="unknown">Unknown</span>
                      </>
                    )}
                  </div>
                  {segment && (
                    <div className="network-record" aria-label="Selected walkway details">
                      <div className="network-record-heading">
                        <strong>{networkKindLabel(segment.kind)} section</strong>
                        <button onClick={() => setSelected('')}>Close details</button>
                      </div>
                      {networkSectionName(segment) && <p>{networkSectionName(segment)}</p>}
                      <p>
                        {segment.cover === 'covered'
                          ? 'Recorded as covered'
                          : segment.cover === 'uncovered'
                            ? 'Recorded as exposed to rain'
                            : 'Cover status unknown'}
                      </p>
                      {segment.enabled === false && (
                        <p className="search-notice">Recorded as disabled. Do not assume access.</p>
                      )}
                      <details>
                        <summary>Source details</summary>
                        <p>
                          A structure can contain several mapped sections. Selecting one highlights
                          that section; it does not change your route.
                        </p>
                        {sourceHeights.length > 0 && (
                          <p>
                            Source height {Math.min(...sourceHeights).toFixed(1)}–
                            {Math.max(...sourceHeights).toFixed(1)} m HKPD.
                          </p>
                        )}
                        {segment.accessTimeId && (
                          <p>An access-hours reference exists; its hours have not been checked.</p>
                        )}
                        {segment.floorId && (
                          <p>A floor reference exists; no floor-plan match is asserted.</p>
                        )}
                        <p>
                          Record {segment.id} · amended{' '}
                          {segment.amendedAt
                            ? new Date(segment.amendedAt).toLocaleDateString()
                            : 'date unavailable'}
                          .
                        </p>
                      </details>
                    </div>
                  )}
                </>
              )}
              <details>
                <summary>About these walkways</summary>
                <p>
                  Government network sections within 50 m horizontally of your route. One bridge,
                  underpass or escalator can contain multiple sections; these are not counts of
                  separate structures.
                </p>
                <p>
                  “Pedestrian underpass” is called “Subway” in the source. It does not mean an MTR
                  train route.
                </p>
                <p>
                  These paths are nearby, not confirmed parts of your route. Current access, working
                  lifts and continuous rain cover are not verified.
                </p>
                <p>
                  Fetched {new Date(data.fetchedAt).toLocaleString()}. The height diagram uses HKPD
                  source heights and cannot determine your floor.
                </p>
                <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                  Lands Department pedestrian network ↗
                </a>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
