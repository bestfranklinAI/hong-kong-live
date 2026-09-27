import { useMemo, useState } from 'react';
import type { WalkingRoute } from '@hk/contracts';
import { profileDrawing, routeProfile } from './route-profile';
export function RouteHeightProfile({ route }: { route: WalkingRoute }) {
  const points = useMemo(() => routeProfile(route.paths), [route.paths]);
  const drawing = useMemo(() => profileDrawing(points), [points]);
  const [index, setIndex] = useState(0);
  const selected = points[Math.min(index, points.length - 1)];
  if (!drawing)
    return <p className="search-notice">Source heights are unavailable for this route.</p>;
  return (
    <section className="route-height-profile" aria-label="Source height profile">
      <h3>How the route changes height</h3>
      <p className="search-notice">
        Source Z values · units and vertical reference unverified. These are not floors or heights
        above the street. Gaps mean missing data.
      </p>
      <svg
        viewBox="0 0 400 162"
        role="img"
        aria-label={`Source height ranges from ${drawing.min.toFixed(1)} to ${drawing.max.toFixed(1)}. Horizontal path distance ${Math.round(drawing.distance)} metres.`}
      >
        <path d="M28 24V126H372" fill="none" stroke="#b6c9c2" />
        <path
          d={drawing.path}
          fill="none"
          stroke="#147d73"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <text x="28" y="16">
          {drawing.max.toFixed(1)} source Z
        </text>
        <text x="28" y="150">
          0 m
        </text>
        <text x="372" y="150" textAnchor="end">
          {Math.round(drawing.distance)} m horizontal
        </text>
        <line
          x1={drawing.x(selected.distanceM)}
          x2={drawing.x(selected.distanceM)}
          y1="24"
          y2="126"
          stroke="#ee704f"
          strokeDasharray="3 3"
        />
        {selected.height !== null && (
          <circle
            cx={drawing.x(selected.distanceM)}
            cy={drawing.y(selected.height)}
            r="5"
            fill="#ee704f"
            stroke="white"
            strokeWidth="2"
          />
        )}
      </svg>
      <label>
        Inspect route height
        <input
          type="range"
          min="0"
          max={points.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${Math.round(selected.distanceM)} metres along path; ${selected.height === null ? 'height unknown' : `source Z ${selected.height.toFixed(1)}`}`}
        />
      </label>
      <output>
        {Math.round(selected.distanceM)} m along path ·{' '}
        {selected.height === null ? 'height unknown' : `source Z ${selected.height.toFixed(1)}`}
      </output>
      <p className="search-provenance">
        {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)} · Horizontal distance excludes gaps and
        lift travel; it may differ from the provider’s total.
      </p>
    </section>
  );
}
