import {
  Cartesian3,
  HeadingPitchRange,
  Matrix4,
  PerspectiveFrustum,
  type CesiumWidget,
} from 'cesium';
import type { LocationFix, UserLocation } from './UserLocation';
import { canGuideFrom } from '../shared/location-quality';

/** Smooth camera updates stay inside the renderer, independent of React's GPS updates. */
export class NavigationCamera {
  private active = false;
  private following = true;
  private fix: LocationFix | null = null;
  private pose?: { lng: number; lat: number; heading: number; z: number };
  private z = 3;
  private previous = performance.now();
  private lastPaint?: {
    lng: number;
    lat: number;
    heading: number;
    z: number;
    top: number;
    bottom: number;
    city: boolean;
  };
  private removeRender: () => void;
  private onPan = () => this.pause();
  /** Map buttons and canvas gestures share the same manual-camera handoff. */
  pause() {
    if (this.active && this.following) {
      this.following = false;
      this.onFollowChange?.(false);
    }
  }
  constructor(
    private widget: CesiumWidget,
    private user: UserLocation,
    private onFollowChange?: (following: boolean) => void,
    private getInsets: () => { top: number; bottom: number } = () => ({ top: 0, bottom: 0 }),
    private cityView: () => boolean = () => true,
  ) {
    this.removeRender = widget.scene.preRender.addEventListener(() => this.render());
    widget.canvas.addEventListener('pointerdown', this.onPan, { passive: true });
    widget.canvas.addEventListener('wheel', this.onPan, { passive: true });
  }
  set(active: boolean, following: boolean, fix: LocationFix | null, z?: number | null) {
    if (active !== this.active) {
      this.widget.camera.cancelFlight();
      this.pose = undefined;
    }
    if (following !== this.following || active !== this.active) this.lastPaint = undefined;
    this.active = active;
    this.following = following;
    this.fix = fix;
    this.z = z ?? 3;
    this.user.setNavigating(active && canGuideFrom(fix));
    if (fix) this.user.set({ ...fix, z: this.z });
    else if (active) this.user.clear();
    this.widget.scene.requestRender();
  }
  private render() {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.previous) / 1000));
    this.previous = now;
    if (!this.active || !this.following || !this.fix || !canGuideFrom(this.fix)) return;
    const heading =
      this.user.direction() === undefined
        ? (this.pose?.heading ?? 0)
        : (this.user.direction()! * Math.PI) / 180;
    const target = { lng: this.fix.lng, lat: this.fix.lat, heading, z: this.z };
    if (!this.pose) this.pose = { ...target };
    const blend = 1 - Math.exp(-dt * 6);
    const turn = Math.atan2(
      Math.sin(heading - this.pose.heading),
      Math.cos(heading - this.pose.heading),
    );
    this.pose.lng += (target.lng - this.pose.lng) * blend;
    this.pose.lat += (target.lat - this.pose.lat) * blend;
    this.pose.z += (target.z - this.pose.z) * blend;
    this.pose.heading += turn * blend;
    const insets = this.getInsets();
    const city = this.cityView();
    const previous = this.lastPaint;
    if (
      previous &&
      Math.abs(previous.lng - this.pose.lng) + Math.abs(previous.lat - this.pose.lat) <
        0.000000002 &&
      Math.abs(previous.heading - this.pose.heading) < 0.0001 &&
      Math.abs(previous.z - this.pose.z) < 0.01 &&
      previous.top === insets.top &&
      previous.bottom === insets.bottom &&
      previous.city === city
    )
      return;
    this.lastPaint = { ...this.pose, ...insets, city };
    const camera = this.widget.camera;
    camera.lookAt(
      Cartesian3.fromDegrees(this.pose.lng, this.pose.lat, this.pose.z),
      new HeadingPitchRange(this.pose.heading, this.cityView() ? -Math.PI / 3 : -Math.PI / 2, 160),
    );
    camera.lookAtTransform(Matrix4.IDENTITY);
    const height = this.widget.canvas.clientHeight;
    if (height && camera.frustum instanceof PerspectiveFrustum && camera.frustum.fovy) {
      const shift =
        ((insets.bottom - insets.top) / height) * 160 * Math.tan(camera.frustum.fovy / 2);
      const destination = Cartesian3.subtract(
        camera.positionWC,
        Cartesian3.multiplyByScalar(camera.upWC, shift, new Cartesian3()),
        new Cartesian3(),
      );
      camera.setView({
        destination,
        orientation: { direction: camera.directionWC, up: camera.upWC },
      });
    }
    if (
      Math.abs(target.lng - this.pose.lng) + Math.abs(target.lat - this.pose.lat) > 0.00000002 ||
      Math.abs(turn) > 0.001 ||
      Math.abs(target.z - this.pose.z) > 0.02
    )
      this.widget.scene.requestRender();
  }
  dispose() {
    this.removeRender();
    this.widget.canvas.removeEventListener('pointerdown', this.onPan);
    this.widget.canvas.removeEventListener('wheel', this.onPan);
  }
}
