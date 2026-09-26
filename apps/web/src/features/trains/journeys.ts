import {
  approaches,
  approachDistance,
  STATION_DWELL_MS,
  type TrainApproach,
  type TrainMotionInput,
} from './motion';

export interface Journey {
  id: string;
  row: TrainApproach;
  distance: number;
  speed: number;
  bornAt: number;
  confirmedAt: number;
  arrivedAt?: number;
  retiredAt?: number;
}
const compatible = (a: TrainApproach, b: TrainApproach) =>
  a.line === b.line &&
  a.arrival.direction === b.arrival.direction &&
  a.arrival.destinationCode === b.arrival.destinationCode;

/** Local illustration identities only. Never exposes an inferred identity as an MTR vehicle ID. */
export class TrainJourneys {
  private journeys: Journey[] = [];
  private lastTime?: number;
  private line?: string;
  private sequence = 0;
  reset() {
    this.journeys = [];
    this.lastTime = undefined;
  }
  update(input: TrainMotionInput | null, now: number): Journey[] {
    if (!input?.enabled || input.selection.line !== this.line) {
      this.reset();
      this.line = input?.selection.line;
    }
    if (!input?.enabled) return [];
    // Do not fast-forward across suspended tabs; rebuild from current observations.
    if (this.lastTime !== undefined && now - this.lastTime > 5000) this.reset();
    const dt = Math.max(0, Math.min(0.25, (now - (this.lastTime ?? now)) / 1000));
    this.lastTime = now;
    const candidates = approaches(input, now);
    const claimed = new Set<TrainApproach>();
    for (const journey of this.journeys) {
      if (journey.retiredAt !== undefined) continue;
      const source =
        input.stationFeeds?.find((entry) => entry.station === journey.row.station)?.feed ??
        (input.stationFeeds ? undefined : input.feed);
      if (
        source &&
        (source.mode !== 'live' ||
          source.status !== 'fresh' ||
          !source.sourceUpdatedAt ||
          now - Date.parse(source.sourceUpdatedAt) >= 90000 ||
          now - Date.parse(source.fetchedAt) >= 90000 ||
          source.data?.some((arrival) => /delay/i.test(arrival.remark)))
      ) {
        journey.retiredAt = now;
        continue;
      }

      const matches = candidates.filter(
        (row) =>
          !claimed.has(row) &&
          compatible(row, journey.row) &&
          row.segment?.id === journey.row.segment?.id &&
          row.station === journey.row.station &&
          Math.abs(row.endsAt - journey.row.endsAt) <= 45000,
      );
      // Ambiguity is not evidence of identity. Keep the last estimate briefly instead.
      if (matches.length === 1) {
        journey.row = matches[0];
        journey.confirmedAt = now;
        claimed.add(matches[0]);
      }
    }
    for (const journey of this.journeys) {
      if (journey.retiredAt !== undefined) continue;
      if (journey.arrivedAt !== undefined && now - journey.arrivedAt >= STATION_DWELL_MS) {
        const end =
          journey.row.to > journey.row.from ? journey.row.segment?.to : journey.row.segment?.from;
        const next = candidates.filter(
          (row) =>
            compatible(row, journey.row) &&
            row.segment?.id !== journey.row.segment?.id &&
            (row.to > row.from ? row.segment?.from : row.segment?.to) === end &&
            row.endsAt > now + 15000 &&
            row.endsAt < now + 240000,
        );
        if (next.length === 1) {
          // Adopt the downstream estimate without drawing a second copy of this illustration.
          const target = next[0];
          this.journeys = this.journeys.filter(
            (other) => other === journey || other.row !== target,
          );
          journey.row = target;
          journey.distance = target.from;
          journey.arrivedAt = undefined;
          journey.confirmedAt = now;
          claimed.add(target);
        } else if (now - journey.arrivedAt > STATION_DWELL_MS + 15000) journey.retiredAt = now;
      }
      // Brief gaps fade out; stale/fixture/delayed feeds never sustain a journey indefinitely.
      if (now - journey.confirmedAt > 30000) journey.retiredAt ??= now;
      if (journey.arrivedAt !== undefined || journey.retiredAt !== undefined) continue;
      if (journey.row.departure && now < journey.row.startsAt) continue;
      const remaining = Math.abs(journey.row.to - journey.distance);
      if (remaining < 0.5) {
        journey.distance = journey.row.to;
        journey.speed = 0;
        journey.arrivedAt = now;
        continue;
      }
      const seconds = Math.max(1, (journey.row.endsAt - now) / 1000);
      // Bounded acceleration and braking absorb ETA revisions without teleporting or reversing.
      const desired = Math.min(25, Math.sqrt(2 * 1.2 * remaining), (remaining / seconds) * 1.2);
      journey.speed += Math.max(-1.2 * dt, Math.min(1.2 * dt, desired - journey.speed));
      const step = Math.min(remaining, journey.speed * dt);
      journey.distance += Math.sign(journey.row.to - journey.row.from) * step;
    }
    this.journeys = this.journeys.filter(
      (j) => j.retiredAt === undefined || now - j.retiredAt < 1000,
    );
    for (const row of candidates) {
      if (claimed.has(row) || this.journeys.length >= 54) continue;
      if (
        this.journeys.some((j) => compatible(j.row, row) && j.row.segment?.id === row.segment?.id)
      )
        continue;
      this.journeys.push({
        id: `journey-${++this.sequence}`,
        row,
        distance: approachDistance(row, now),
        speed: 0,
        bornAt: now,
        confirmedAt: now,
      });
    }
    return this.journeys;
  }
}
