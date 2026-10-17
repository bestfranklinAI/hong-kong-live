import { floorDrawing } from './floor-drawing';
import { createPortal } from 'react-dom';
import { useState, useRef, useEffect, useId } from 'react';
import type { IndoorFloor } from '@hk/contracts';
import { exitCode } from './station-exits';
import { groupFloorPoints } from './floor-point-groups';
import { NavigationIcon } from './NavigationIcon';
import { indoorCategoryLabels } from './indoor-map';

export function FloorDiagram({
  floor,
  points,
  layout,
  selected,
  onSelect,
  zoom = 1,
  rotation = 0,
  onZoom,
  routePaths = [],
  recommendedExitId,
  levelChanges = [],
}: {
  routePaths?: number[][][];
  recommendedExitId?: string;
  levelChanges?: Array<{ point: number[]; direction: 'up' | 'down' }>;
  zoom?: number;
  rotation?: number;
  onZoom?: (x: number, y: number) => void;
  floor: IndoorFloor;
  points: import('@hk/contracts').IndoorPoint[];
  layout?: import('@hk/contracts').IndoorLayout;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const arrowId = useId().replace(/:/g, '');
  const host = useRef<HTMLDivElement>(null);
  const [diagramWidth, setDiagramWidth] = useState(320);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setDiagramWidth(entry.contentRect.width);
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const display = floorDrawing(floor, points);
  const path = (ring: number[][]) =>
    ring.map((p, i) => `${i ? 'L' : 'M'}${display(p).join(',')}`).join(' ');
  const groups = groupFloorPoints(
    [...points].sort(
      (a, b) =>
        ['entry', 'elevator', 'restroom', 'escalator', 'stairs', 'ramp', 'platform'].indexOf(
          a.category,
        ) -
        ['entry', 'elevator', 'restroom', 'escalator', 'stairs', 'ramp', 'platform'].indexOf(
          b.category,
        ),
    ),
    (p) => display([p.lng, p.lat]),
    (48 * 320) / (diagramWidth * zoom),
  );
  const expandedGroup = groups.find((group) => group.points.some((point) => point.id === expanded));
  return (
    <>
      <div className="floor-diagram" ref={host}>
        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label={`${floor.name}, official floor boundary and mapped points${routePaths.length ? `, highlighted route and ${levelChanges.length} level change markers` : ''}`}
        >
          <defs>
            <clipPath id={`${arrowId}-floor`}>
              <path
                d={floor.polygons
                  .map((polygon) => polygon.map((ring) => path(ring) + 'Z').join(' '))
                  .join(' ')}
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </clipPath>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10z" fill="#147d73" />
            </marker>
          </defs>
          {floor.polygons.map((polygon, i) => (
            <path
              key={i}
              d={polygon.map((r) => path(r) + 'Z').join(' ')}
              fill="#f4f0fa"
              fillRule="evenodd"
              stroke="#765aa2"
              strokeWidth={1.5 / zoom}
            />
          ))}
          {layout?.units
            .filter((u) => u.levelId === floor.id)
            .flatMap((u) =>
              u.lines.map((l, i) => (
                <path
                  key={`${u.id}-${i}`}
                  d={path(l)}
                  fill="none"
                  stroke="#9baba8"
                  strokeWidth={1 / zoom}
                />
              )),
            )}
          {layout?.openings
            .filter((u) => u.levelId === floor.id)
            .flatMap((u) =>
              u.lines.map((l, i) => (
                <path
                  key={`${u.id}-${i}`}
                  d={path(l)}
                  fill="none"
                  stroke="#087f8c"
                  strokeWidth={2 / zoom}
                />
              )),
            )}
          {routePaths.map((run, index) => (
            <path
              key={`route-${index}`}
              clipPath={`url(#${arrowId}-floor)`}
              d={path(run)}
              fill="none"
              stroke="#147d73"
              strokeWidth={4 / zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#${arrowId})`}
            />
          ))}
          {levelChanges.map((change, index) => {
            const [x, y] = display(change.point);
            return (
              <g key={`change-${index}`} transform={`translate(${x},${y}) scale(${1 / zoom})`}>
                <title>Level change: {change.direction}. Follow station signs.</title>
                <circle r="10" fill="#fff" stroke="#bb7136" strokeWidth="2" />
                <path
                  d={change.direction === 'up' ? 'M0 5V-5M-4-1L0-5L4-1' : 'M0-5V5M-4 1L0 5L4 1'}
                  fill="none"
                  stroke="#bb7136"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>
        {groups.map((group) => {
          const p = group.points[0]!;
          const { x, y } = group;
          const exits = group.points.filter((point) => point.category === 'entry');
          const exitNames = [...new Set(exits.map((point) => exitCode(point.name)))];
          const exitLabel = exitNames.every((name) => /^[A-Z]?[0-9]{0,2}[A-Z]?$/i.test(name))
            ? exitNames.slice(0, 2).join(' / ') +
              (exitNames.length > 2 ? ` +${exitNames.length - 2}` : '')
            : 'Entrance';
          return (
            <button
              key={p.id}
              className={`floor-plan-point${exits.length ? ' floor-plan-exit' : ''}${group.points.some((point) => point.id === recommendedExitId) ? ' floor-plan-route-exit' : ''}`}
              style={{
                left: `${(x! / 320) * 100}%`,
                top: `${(y! / 320) * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / zoom}) rotate(${-rotation}deg)`,
              }}
              aria-label={
                group.points.length > 1
                  ? `${exits.map((point) => point.name).join(', ')}${exits.length ? '. ' : ''}${group.points.length} nearby points. ${zoom < 8 ? 'Zoom in' : 'Show list'}`
                  : `${p.name}, ${indoorCategoryLabels[p.category]}`
              }
              aria-pressed={group.points.some((point) => point.id === selected)}
              onClick={() => {
                if (group.points.length > 1 && zoom < 8 && onZoom) {
                  setExpanded(null);
                  onZoom(x / 320, y / 320);
                } else if (group.points.length > 1) setExpanded(p.id);
                else {
                  setExpanded(null);
                  onSelect(p.id);
                }
              }}
            >
              {exits.length ? (
                <span
                  className="floor-exit-label"
                  title={exits.map((point) => point.name).join(', ')}
                >
                  {group.points.some((point) => point.id === recommendedExitId) && (
                    <small>Route exit </small>
                  )}
                  {exitLabel}
                </span>
              ) : group.points.length > 1 ? (
                <span className="floor-amenity-cluster">
                  <NavigationIcon kind={p.category} />
                  <small>{group.points.length}</small>
                </span>
              ) : (
                <NavigationIcon kind={p.category} />
              )}
            </button>
          );
        })}
      </div>
      {expandedGroup &&
        host.current?.closest('.indoor-canvas-shell') &&
        createPortal(
          <div className="floor-point-list indoor-point-popover" aria-label="Nearby indoor points">
            <button onClick={() => setExpanded(null)}>Close nearby points</button>
            {expandedGroup.points.map((point) => (
              <button
                key={point.id}
                aria-pressed={selected === point.id}
                onClick={() => onSelect(point.id)}
              >
                <NavigationIcon kind={point.category} />
                <span>
                  {point.name}
                  <small>{indoorCategoryLabels[point.category]}</small>
                </span>
              </button>
            ))}
          </div>,
          host.current.closest('.indoor-canvas-shell')!,
        )}
    </>
  );
}
