import { useLayoutEffect, useRef, type ReactNode, type PointerEvent } from 'react';
import {
  chooseSnap,
  haptic,
  sheetHeights,
  snapOrder,
  springStep,
  type SheetSnap,
} from './sheet-motion';

interface Props {
  mobile: boolean;
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  header: ReactNode;
  children: ReactNode;
  mode: string;
}

/** A nonmodal sheet: the uncovered map stays interactive and keyboard navigation stays available. */
export function DiscoverySheet({ mobile, snap, onSnap, header, children, mode }: Props) {
  const host = useRef<HTMLElement>(null);
  const current = useRef(96);
  const frame = useRef(0);
  const drag = useRef<{
    y: number;
    height: number;
    lastY: number;
    time: number;
    velocity: number;
  } | null>(null);
  const animate = useRef<(snap: SheetSnap) => void>(() => {});
  const suppressedClick = useRef(false);

  useLayoutEffect(() => {
    const element = host.current;
    if (!mobile || !element) return;
    const root = element.closest<HTMLElement>('.atlas-app')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const heights = () =>
      sheetHeights(
        window.visualViewport?.height ?? innerHeight,
        parseFloat(getComputedStyle(element).paddingBottom) || 0,
      );
    const paint = (height: number) => {
      current.current = height;
      element.style.height = `${heights().full}px`;
      const keyboard = Math.max(
        0,
        innerHeight -
          (window.visualViewport?.height ?? innerHeight) -
          (window.visualViewport?.offsetTop ?? 0),
      );
      element.style.bottom = `${keyboard}px`;
      element.style.setProperty('--sheet-height', `${height}px`);
      element.style.transform = `translate3d(0, ${heights().full - height}px, 0)`;
      root.style.setProperty('--sheet-visible', `${height + keyboard}px`);
    };
    const settle = () => {
      // ResizeObserver cannot see transforms: notify the map once the spring settles.
      window.dispatchEvent(new Event('hk-sheet-settled'));
    };
    animate.current = (next) => {
      cancelAnimationFrame(frame.current);
      const target = heights()[next];
      if (reduced.matches) {
        paint(target);
        settle();
        return;
      }
      let velocity = 0,
        last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.032);
        last = now;
        const state = springStep(current.current, velocity, target, dt);
        velocity = state.velocity;
        paint(state.position);
        if (Math.abs(current.current - target) < 0.5 && Math.abs(velocity) < 1) {
          paint(target);
          haptic();
          settle();
        } else frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    };
    paint(current.current);
    animate.current(snap);
    const resize = () => {
      cancelAnimationFrame(frame.current);
      paint(heights()[snap]);
      settle();
    };
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame.current);
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      root.style.removeProperty('--sheet-visible');
      element.style.removeProperty('transform');
      element.style.removeProperty('height');
      element.style.removeProperty('bottom');
      element.style.removeProperty('--sheet-height');
    };
  }, [mobile, snap]);

  function down(event: PointerEvent<HTMLElement>) {
    if (
      !mobile ||
      event.pointerType === 'touch' ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest('input,select,a,[data-no-drag]')
    )
      return;
    cancelAnimationFrame(frame.current);
    suppressedClick.current = false;
    drag.current = {
      y: event.clientY,
      height: current.current,
      lastY: event.clientY,
      time: performance.now(),
      velocity: 0,
    };
    ((event.target as HTMLElement).closest('button') ?? event.currentTarget).setPointerCapture(
      event.pointerId,
    );
  }
  function move(event: { clientY: number }) {
    const start = drag.current;
    if (!start || !host.current) return;
    const now = performance.now();
    start.velocity = (start.lastY - event.clientY) / Math.max(1, now - start.time);
    start.lastY = event.clientY;
    start.time = now;
    const bounds = sheetHeights(
      window.visualViewport?.height ?? innerHeight,
      parseFloat(getComputedStyle(host.current).paddingBottom) || 0,
    );
    const height = Math.max(
      bounds.peek,
      Math.min(bounds.full, start.height + start.y - event.clientY),
    );
    if (Math.abs(start.y - event.clientY) > 5) suppressedClick.current = true;
    current.current = height;
    host.current.style.setProperty('--sheet-height', `${height}px`);
    host.current.style.transform = `translate3d(0, ${bounds.full - height}px, 0)`;
    host.current
      .closest<HTMLElement>('.atlas-app')
      ?.style.setProperty('--sheet-visible', `${height}px`);
  }
  function up(event: { type: string }) {
    const start = drag.current;
    if (!start || !host.current) return;
    drag.current = null;
    const heights = sheetHeights(
      window.visualViewport?.height ?? innerHeight,
      parseFloat(getComputedStyle(host.current).paddingBottom) || 0,
    );
    const velocity = performance.now() - start.time > 100 ? 0 : start.velocity;
    const next =
      event.type === 'pointercancel' ? snap : chooseSnap(current.current, velocity, snap, heights);
    // Animate before updating the semantic state; the next layout effect continues from here.
    onSnap(next);
    animate.current(next);
  }

  // Native non-passive touch handling allows scroll-to-drag handoff at the list's
  // top edge. Pointer handlers remain a mouse/pen and keyboard fallback.
  useLayoutEffect(() => {
    const element = host.current;
    if (!mobile || !element) return;
    let candidate: { x: number; y: number; scroll: HTMLElement | null; header: boolean } | null =
      null;
    let dragging = false;
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const target = event.target as HTMLElement;
      // Even form controls can start a vertical sheet swipe. Ordinary taps
      // remain native until movement crosses the direction-lock threshold.
      const touch = event.touches[0];
      candidate = {
        x: touch.clientX,
        y: touch.clientY,
        scroll: target.closest('.panel-scroll'),
        header: Boolean(target.closest('.sheet-header')),
      };
      suppressedClick.current = false;
    };
    const slide = (event: TouchEvent) => {
      if (!candidate) return;
      if (event.touches.length !== 1) {
        finish(true);
        return;
      }
      const touch = event.touches[0];
      const dy = touch.clientY - candidate.y,
        dx = touch.clientX - candidate.x;
      if (!dragging) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          candidate = null;
          return;
        }
        // At full height, let the browser scroll until a new downward gesture
        // begins at the top. Do not steal a gesture from a scrolling list.
        if (
          !candidate.header &&
          snap === 'full' &&
          (dy < 0 || (candidate.scroll?.scrollTop ?? 0) > 0)
        ) {
          candidate = null;
          return;
        }
        if (!event.cancelable) {
          candidate = null;
          return;
        }
        cancelAnimationFrame(frame.current);
        drag.current = {
          y: candidate.y,
          height: current.current,
          lastY: touch.clientY,
          time: performance.now(),
          velocity: 0,
        };
        dragging = true;
      }
      event.preventDefault();
      event.stopPropagation();
      move(touch);
    };
    const finish = (cancelled = false) => {
      if (dragging) up({ type: cancelled ? 'pointercancel' : 'touchend' });
      dragging = false;
      candidate = null;
    };
    const end = () => finish();
    const cancel = () => finish(true);
    const click = (event: MouseEvent) => {
      if (suppressedClick.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        suppressedClick.current = false;
      }
    };
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchmove', slide, { passive: false });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('click', click, true);
    return () => {
      element.removeEventListener('touchstart', start);
      element.removeEventListener('touchmove', slide);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', cancel);
      element.removeEventListener('click', click, true);
    };
  });

  return (
    <aside
      ref={host}
      className={`discovery-panel ${mobile ? 'mobile-sheet' : ''}`}
      data-snap={snap}
      id="discovery"
      aria-label={`${mode} panel`}
    >
      {mobile && (
        <div
          className="sheet-header"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <button
            className="sheet-handle"
            aria-label={`Panel ${snap}. Change panel height`}
            aria-expanded={snap !== 'peek'}
            onClick={(event) => {
              if (event.detail === 0 || !suppressedClick.current)
                onSnap(snapOrder[(snapOrder.indexOf(snap) + 1) % 3]);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                onSnap(
                  snapOrder[
                    Math.max(
                      0,
                      Math.min(2, snapOrder.indexOf(snap) + (event.key === 'ArrowUp' ? 1 : -1)),
                    )
                  ],
                );
              }
            }}
          >
            <span />
          </button>
          {header}
          {snap === 'peek' && <span className="sheet-swipe-hint">Swipe up to explore</span>}
        </div>
      )}
      {children}
      {mobile && snap === 'half' && (
        <button className="sheet-expand" onClick={() => onSnap('full')}>
          See full details ↑
        </button>
      )}
    </aside>
  );
}
