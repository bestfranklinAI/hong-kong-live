import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from 'react';
import { Compass, LocateFixed, Scan } from 'lucide-react';
import {
  angleDelta,
  rotateIndoorCamera,
  zoomIndoorCamera,
  type IndoorCamera,
} from './indoor-camera';

/** Local plan camera. Pointer frames update one DOM transform, never the city renderer or React state. */
export function IndoorMapCanvas({
  children,
  initialView,
  overlay,
  initialRotation = 0,
  onRotationChange,
}: {
  initialRotation?: number;
  onRotationChange?: (rotation: number) => void;
  overlay?: ReactNode;
  initialView?: { x: number; y: number; scale: number };
  children: (scale: number, focus: (x: number, y: number) => void, rotation: number) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  // Frame once per floor. Later amenity responses must not undo a user's pan or pinch.
  const initialCamera = useRef(initialView);
  const camera = useRef<IndoorCamera>({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef(false);
  const suppressClickUntil = useRef(0);
  const [bearing, setBearing] = useState(initialRotation);
  useEffect(() => onRotationChange?.(bearing), [bearing, onRotationChange]);
  const [directionMessage, setDirectionMessage] = useState('');
  const headingCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => headingCleanup.current?.(), []);
  const [scale, setScale] = useState(1);
  const apply = useCallback(() => {
    const c = camera.current;
    // Keep some of the plan reachable even after a long drag.
    const bounds = host.current?.getBoundingClientRect();
    if (bounds) {
      const limit = (Math.min(bounds.width, bounds.height) * c.scale) / 2;
      c.x = Math.max(-limit, Math.min(limit, c.x));
      c.y = Math.max(-limit, Math.min(limit, c.y));
    }
    if (world.current)
      world.current.style.transform = `translate(-50%, -50%) translate(${c.x}px, ${c.y}px) rotate(${c.rotation ?? 0}deg) scale(${c.scale})`;
  }, []);
  const reset = useCallback(() => {
    const view = initialCamera.current;
    const size = world.current?.offsetWidth ?? 320;
    camera.current = view
      ? {
          scale: view.scale,
          x: -(view.x - 0.5) * size * view.scale,
          y: -(view.y - 0.5) * size * view.scale,
        }
      : { x: 0, y: 0, scale: 1 };
    apply();
    setScale(camera.current.scale);
    setBearing(0);
  }, [apply]);
  const firstRotation = useRef(initialRotation);
  useLayoutEffect(() => {
    reset();
    camera.current = rotateIndoorCamera(camera.current, firstRotation.current);
    apply();
    setBearing(firstRotation.current);
  }, [reset, apply]);
  const zoom = (factor: number) => {
    camera.current = zoomIndoorCamera(camera.current, factor);
    apply();
    setScale(camera.current.scale);
  };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('button')) return;
      event.preventDefault();
      const b = element.getBoundingClientRect();
      camera.current = zoomIndoorCamera(
        camera.current,
        Math.exp(-event.deltaY * 0.002),
        event.clientX - b.left - b.width / 2,
        event.clientY - b.top - b.height / 2,
      );
      apply();
      clearTimeout(settle);
      settle = setTimeout(() => setScale(camera.current.scale), 120);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', wheel);
      clearTimeout(settle);
    };
  }, [apply]);
  const alignDirection = async () => {
    headingCleanup.current?.();
    setDirectionMessage('Waiting for compass…');
    if (typeof DeviceOrientationEvent === 'undefined') {
      setDirectionMessage('Compass unavailable. Rotate with two fingers.');
      return;
    }
    const sensor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };
    try {
      if (sensor.requestPermission && (await sensor.requestPermission()) !== 'granted') {
        setDirectionMessage('Compass permission denied. Rotate with two fingers.');
        return;
      }
      const orientation = (event: DeviceOrientationEvent) => {
        const compass = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
        const heading = Number.isFinite(compass.webkitCompassHeading)
          ? compass.webkitCompassHeading
          : event.absolute && event.alpha !== null
            ? 360 - event.alpha
            : undefined;
        if (heading === undefined) return;
        const target = -(heading + (screen.orientation?.angle ?? 0));
        camera.current = rotateIndoorCamera(
          camera.current,
          angleDelta(camera.current.rotation ?? 0, target),
        );
        apply();
        setBearing(camera.current.rotation ?? 0);
        setDirectionMessage('');
        headingCleanup.current?.();
      };
      window.addEventListener('deviceorientationabsolute', orientation as EventListener);
      window.addEventListener('deviceorientation', orientation);
      const timeout = setTimeout(() => {
        headingCleanup.current?.();
        setDirectionMessage('Compass unavailable. Rotate with two fingers.');
      }, 8000);
      headingCleanup.current = () => {
        clearTimeout(timeout);
        window.removeEventListener('deviceorientationabsolute', orientation as EventListener);
        window.removeEventListener('deviceorientation', orientation);
      };
    } catch {
      setDirectionMessage('Compass unavailable. Rotate with two fingers.');
    }
  };
  const end = (event: PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (gesture.current) suppressClickUntil.current = performance.now() + 350;
    if (!pointers.current.size) {
      gesture.current = false;
      setScale(camera.current.scale);
      setBearing(camera.current.rotation ?? 0);
    }
  };
  return (
    <div className="indoor-canvas-shell">
      <div
        ref={host}
        className="indoor-canvas"
        role="group"
        aria-label="Interactive indoor map"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === '+' || event.key === '=') zoom(1.5);
          else if (event.key === '[' || event.key === ']') {
            headingCleanup.current?.();
            camera.current = rotateIndoorCamera(camera.current, event.key === '[' ? -15 : 15);
            apply();
            setBearing(camera.current.rotation ?? 0);
          } else if (event.key === '-') zoom(1 / 1.5);
          else if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            camera.current.x +=
              event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
            camera.current.y += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
            apply();
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          headingCleanup.current?.();
          setDirectionMessage('');
          event.stopPropagation();
        }}
        onPointerMove={(event) => {
          const old = pointers.current.get(event.pointerId);
          if (!old) return;
          const next = { x: event.clientX, y: event.clientY };
          const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
          if (other) {
            const before = Math.hypot(old.x - other.x, old.y - other.y);
            const after = Math.hypot(next.x - other.x, next.y - other.y);
            const b = event.currentTarget.getBoundingClientRect();
            if (before > 4)
              camera.current = zoomIndoorCamera(
                camera.current,
                after / before,
                (old.x + other.x) / 2 - b.left - b.width / 2,
                (old.y + other.y) / 2 - b.top - b.height / 2,
              );
            const previousAngle = (Math.atan2(old.y - other.y, old.x - other.x) * 180) / Math.PI;
            const nextAngle = (Math.atan2(next.y - other.y, next.x - other.x) * 180) / Math.PI;
            camera.current = rotateIndoorCamera(
              camera.current,
              angleDelta(previousAngle, nextAngle),
              (old.x + other.x) / 2 - b.left - b.width / 2,
              (old.y + other.y) / 2 - b.top - b.height / 2,
            );
            camera.current.x += (next.x - old.x) / 2;
            camera.current.y += (next.y - old.y) / 2;
          } else {
            if (!gesture.current && Math.hypot(next.x - old.x, next.y - old.y) < 3) return;
            camera.current.x += next.x - old.x;
            camera.current.y += next.y - old.y;
          }
          pointers.current.set(event.pointerId, next);
          gesture.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          apply();
          event.stopPropagation();
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onClickCapture={(event) => {
          if (performance.now() < suppressClickUntil.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div ref={world} className="indoor-canvas-world">
          {children(
            scale,
            (x, y) => {
              const size = world.current?.offsetWidth ?? 320;
              const nextScale = Math.min(8, camera.current.scale * 2);
              camera.current = {
                rotation: 0,
                scale: nextScale,
                x: -(x - 0.5) * size * nextScale,
                y: -(y - 0.5) * size * nextScale,
              };
              apply();
              setScale(nextScale);
            },
            bearing,
          )}
        </div>
      </div>
      {directionMessage && (
        <button
          className="indoor-compass-notice"
          onClick={() => setDirectionMessage('')}
          role="status"
        >
          {directionMessage}
        </button>
      )}
      {overlay && <div className="indoor-route-overlay">{overlay}</div>}
      <div className="indoor-map-credit">
        <img src="/landsd-logo.jpg" width="20" height="20" alt="Lands Department" />
        <span>Map from Lands Department</span>
      </div>
      <div className="indoor-canvas-controls" aria-label="Indoor map controls">
        <button
          aria-label="Reset indoor map north"
          onClick={() => {
            headingCleanup.current?.();
            camera.current = rotateIndoorCamera(camera.current, -(camera.current.rotation ?? 0));
            apply();
            setBearing(0);
          }}
        >
          <Compass size={20} style={{ transform: `rotate(${bearing}deg)` }} />
        </button>
        <button aria-label="Align indoor map to my direction" onClick={() => void alignDirection()}>
          <LocateFixed size={20} />
        </button>
        <button
          aria-label={initialView ? 'Fit route on this floor' : 'Fit indoor map'}
          onClick={reset}
        >
          <Scan size={18} />
        </button>
      </div>
    </div>
  );
}
