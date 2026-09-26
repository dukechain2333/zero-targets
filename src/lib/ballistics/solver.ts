// Point-mass (3-DOF) exterior ballistics solver.
//
// Coordinates: x = horizontal range, y = height, z = to the right, all in feet. The line of sight is
// the x axis (level shot), and the bore starts `sightHeight` below it at the muzzle. Drag follows the
// standard-projectile model: a = g - k(Mach) * v_air * |v_air|, where v_air is the velocity relative
// to the air and k = densityRatio * Cd(Mach) * 2.08551e-4 / BC.

import { G1_TABLE, G7_TABLE } from "./drag-tables";

export type DragModel = "G1" | "G7";

export interface Atmosphere {
  /** Air density relative to ICAO standard sea level. */
  densityRatio: number;
  speedOfSoundFps: number;
}

export interface BallisticInput {
  muzzleVelocityFps: number;
  bc: number;
  dragModel: DragModel;
  /** Line of sight above the bore centerline at the muzzle, inches. */
  sightHeightIn: number;
  /** Defaults to ICAO standard sea level. */
  atmosphere?: Atmosphere;
  /** Full-value crosswind from the shooter's left (9 o'clock), mph. */
  crosswindMph?: number;
}

export interface TrajectoryPoint {
  rangeYd: number;
  /** Bullet path relative to the line of sight, inches (+ = above). */
  heightIn: number;
  /** Wind drift, inches (+ = right). */
  windageIn: number;
  velocityFps: number;
  timeS: number;
}

const GRAVITY_FPS2 = 32.17405;
// Standard density (lb/ft^3) * pi / (4 * 2 * 144): turns Cd / BC into a drag factor.
const DRAG_CONSTANT = 2.08551e-4;
const FPS_PER_MPH = 5280 / 3600;

/** Dry air at an altitude (ICAO standard pressure for that altitude) and a measured temperature. */
export function atmosphereAt(altitudeFt: number, temperatureF: number): Atmosphere {
  const altitudeM = altitudeFt * 0.3048;
  const pressureRatio = Math.pow(1 - (0.0065 * altitudeM) / 288.15, 5.255876);
  const tempR = temperatureF + 459.67;
  return {
    densityRatio: pressureRatio * (518.67 / tempR),
    speedOfSoundFps: 49.0223 * Math.sqrt(tempR),
  };
}

export const STANDARD_ATMOSPHERE = atmosphereAt(0, 59);
const TIME_STEP_S = 0.0002;
const MIN_VELOCITY_FPS = 50;

// ---------------------------------------------------------------- drag curve (PCHIP)

interface Pchip {
  x: number[];
  a: number[];
  b: number[];
  c: number[];
  d: number[];
}

const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Monotone piecewise-cubic (Fritsch–Carlson) interpolant through the drag table. */
function pchipPrepare(table: ReadonlyArray<readonly [number, number]>): Pchip {
  const xs = table.map((p) => p[0]);
  const ys = table.map((p) => p[1]);
  const n = xs.length;
  const h = xs.slice(0, -1).map((x, i) => xs[i + 1] - x);
  const delta = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);

  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const d0 = delta[i - 1];
    const d1 = delta[i];
    if (d0 !== 0 && d1 !== 0 && sign(d0) === sign(d1)) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
  }
  const endSlope = (h0: number, h1: number, d0: number, d1: number) => {
    const s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (sign(s) !== sign(d0)) return 0;
    return Math.abs(s) > 3 * Math.abs(d0) ? 3 * d0 : s;
  };
  m[0] = endSlope(h[0], h[1], delta[0], delta[1]);
  m[n - 1] = endSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3]);

  const a: number[] = [];
  const b: number[] = [];
  const c: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const hi = h[i];
    a.push(ys[i]);
    b.push(m[i]);
    c.push((3 * (ys[i + 1] - ys[i]) - (2 * m[i] + m[i + 1]) * hi) / (hi * hi));
    d.push((2 * (ys[i] - ys[i + 1]) + (m[i] + m[i + 1]) * hi) / (hi * hi * hi));
  }
  return { x: xs, a, b, c, d };
}

function pchipEval(p: Pchip, x: number): number {
  const xs = p.x;
  let i: number;
  if (x <= xs[0]) i = 0;
  else if (x >= xs[xs.length - 1]) i = xs.length - 2;
  else {
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    i = lo;
  }
  const dx = x - xs[i];
  return p.a[i] + dx * (p.b[i] + dx * (p.c[i] + dx * p.d[i]));
}

const CURVES: Record<DragModel, Pchip> = {
  G1: pchipPrepare(G1_TABLE),
  G7: pchipPrepare(G7_TABLE),
};

// ---------------------------------------------------------------- integration

/**
 * Integrate the trajectory for a bore elevation (radians above the line of sight) and sample the
 * bullet path at each requested range. Ranges must be ascending, in yards.
 */
export function sampleTrajectory(
  input: BallisticInput,
  elevationRad: number,
  rangesYd: number[],
): TrajectoryPoint[] {
  const curve = CURVES[input.dragModel];
  const atmo = input.atmosphere ?? STANDARD_ATMOSPHERE;
  const dragScale = (atmo.densityRatio * DRAG_CONSTANT) / input.bc;
  const machScale = 1 / atmo.speedOfSoundFps;
  const wz = (input.crosswindMph ?? 0) * FPS_PER_MPH;
  const dt = TIME_STEP_S;

  let x = 0;
  let y = -input.sightHeightIn / 12;
  let z = 0;
  let vx = input.muzzleVelocityFps * Math.cos(elevationRad);
  let vy = input.muzzleVelocityFps * Math.sin(elevationRad);
  let vz = 0;
  let t = 0;

  // Drag acts on the velocity relative to the air.
  const accel = (ux: number, uy: number, uz: number): [number, number, number] => {
    const rz = uz - wz;
    const v = Math.hypot(ux, uy, rz);
    const k = pchipEval(curve, v * machScale) * dragScale * v;
    return [-k * ux, -GRAVITY_FPS2 - k * uy, -k * rz];
  };

  const out: TrajectoryPoint[] = [];
  let next = 0;
  while (next < rangesYd.length && rangesYd[next] <= 0) {
    out.push({ rangeYd: 0, heightIn: y * 12, windageIn: 0, velocityFps: Math.hypot(vx, vy), timeS: 0 });
    next++;
  }

  while (next < rangesYd.length) {
    // Classic RK4 step on (position, velocity).
    const [a1x, a1y, a1z] = accel(vx, vy, vz);
    const v2x = vx + 0.5 * dt * a1x;
    const v2y = vy + 0.5 * dt * a1y;
    const v2z = vz + 0.5 * dt * a1z;
    const [a2x, a2y, a2z] = accel(v2x, v2y, v2z);
    const v3x = vx + 0.5 * dt * a2x;
    const v3y = vy + 0.5 * dt * a2y;
    const v3z = vz + 0.5 * dt * a2z;
    const [a3x, a3y, a3z] = accel(v3x, v3y, v3z);
    const v4x = vx + dt * a3x;
    const v4y = vy + dt * a3y;
    const v4z = vz + dt * a3z;
    const [a4x, a4y, a4z] = accel(v4x, v4y, v4z);

    const nx = x + (dt / 6) * (vx + 2 * v2x + 2 * v3x + v4x);
    const ny = y + (dt / 6) * (vy + 2 * v2y + 2 * v3y + v4y);
    const nz = z + (dt / 6) * (vz + 2 * v2z + 2 * v3z + v4z);
    const nvx = vx + (dt / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
    const nvy = vy + (dt / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    const nvz = vz + (dt / 6) * (a1z + 2 * a2z + 2 * a3z + a4z);
    const nt = t + dt;

    // Emit every requested range crossed during this step (linear interpolation; steps are < 1 ft).
    while (next < rangesYd.length && rangesYd[next] * 3 <= nx) {
      const target = rangesYd[next] * 3;
      const f = (target - x) / (nx - x);
      out.push({
        rangeYd: rangesYd[next],
        heightIn: (y + f * (ny - y)) * 12,
        windageIn: (z + f * (nz - z)) * 12,
        velocityFps: Math.hypot(vx + f * (nvx - vx), vy + f * (nvy - vy), vz + f * (nvz - vz)),
        timeS: t + f * dt,
      });
      next++;
    }

    x = nx;
    y = ny;
    z = nz;
    vx = nvx;
    vy = nvy;
    vz = nvz;
    t = nt;
    if (Math.hypot(vx, vy) < MIN_VELOCITY_FPS || vx <= 0) break;
  }
  return out;
}

export function heightAt(input: BallisticInput, elevationRad: number, rangeYd: number): number {
  const [p] = sampleTrajectory(input, elevationRad, [rangeYd]);
  if (!p) throw new Error(`Bullet does not reach ${rangeYd} yd`);
  return p.heightIn;
}

/**
 * Bore elevation (radians, relative to the line of sight) that puts the bullet on the line of
 * sight at `zeroYd`. Returns the low-angle solution.
 */
export function solveZeroElevation(input: BallisticInput, zeroYd: number): number {
  const rangeIn = zeroYd * 36;
  // Initial guess ignores drag: rise the sight height plus vacuum drop over the zero range.
  const tof = (zeroYd * 3) / input.muzzleVelocityFps;
  let angle = Math.atan((input.sightHeightIn + 0.5 * GRAVITY_FPS2 * tof * tof * 12) / rangeIn);
  for (let i = 0; i < 30; i++) {
    const err = heightAt(input, angle, zeroYd);
    if (Math.abs(err) < 1e-6) return angle;
    // d(height)/d(angle) is ~ range for small angles; a Newton step on that model converges fast.
    angle -= Math.atan(err / rangeIn);
  }
  return angle;
}

/** Ranges (yd) where the bullet path crosses the line of sight, found by bisection on a sample grid. */
export function lineOfSightCrossings(
  input: BallisticInput,
  elevationRad: number,
  maxYd: number,
  stepYd = 1,
): number[] {
  const ranges: number[] = [];
  for (let r = stepYd; r <= maxYd; r += stepYd) ranges.push(r);
  const pts = sampleTrajectory(input, elevationRad, ranges);
  const crossings: number[] = [];
  let prev = { rangeYd: 0, heightIn: -input.sightHeightIn };
  for (const p of pts) {
    if (sign(prev.heightIn) !== sign(p.heightIn) && p.heightIn !== 0) {
      // Refine with a secant step on the (nearly straight) segment.
      const f = prev.heightIn / (prev.heightIn - p.heightIn);
      crossings.push(prev.rangeYd + f * (p.rangeYd - prev.rangeYd));
    }
    prev = p;
  }
  return crossings;
}
