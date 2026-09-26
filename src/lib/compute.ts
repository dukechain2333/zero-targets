import {
  lineOfSightCrossings,
  sampleTrajectory,
  solveZeroElevation,
  type BallisticInput,
  type TrajectoryPoint,
} from "./ballistics/solver";
import { resolveSetup, type ResolvedSetup, type Setup } from "./setup";
import { milInches, moaInches } from "./units";

export interface ZeroResult {
  resolved: ResolvedSetup;
  input: BallisticInput;
  elevationRad: number;
  /** Bullet path at the target distance relative to the line of sight, inches (+ = above aim). */
  offsetIn: number;
  offsetMoa: number;
  offsetMil: number;
  /** Where the bullet path crosses the line of sight, yards (near, far). */
  crossingsYd: number[];
  apex: { rangeYd: number; heightIn: number } | null;
  trajectory: TrajectoryPoint[];
  chartMaxYd: number;
  /** How much the offset moves (inches) for common setup errors. */
  sensitivity: {
    targetPlus1Yd: number;
    mvMinus100Fps: number;
    sightHeightPlusTenth: number;
  };
}

function offsetFor(input: BallisticInput, zeroYd: number, targetYd: number): number {
  const elevation = solveZeroElevation(input, zeroYd);
  return sampleTrajectory(input, elevation, [targetYd])[0]?.heightIn ?? NaN;
}

export function computeZero(setup: Setup): ZeroResult {
  const resolved = resolveSetup(setup);
  const input: BallisticInput = {
    muzzleVelocityFps: resolved.muzzleVelocityFps,
    bc: resolved.bc,
    dragModel: resolved.dragModel,
    sightHeightIn: resolved.sightHeightIn,
  };
  const { zeroYd, targetYd } = setup;

  const elevation = solveZeroElevation(input, zeroYd);
  const [atTarget, atTargetPlus1] = sampleTrajectory(input, elevation, [targetYd, targetYd + 1]);
  const offsetIn = atTarget?.heightIn ?? NaN;

  // A zero near the top of the arc barely touches the sight line, so make sure it is listed.
  const crossingsYd = lineOfSightCrossings(input, elevation, 1000, 1);
  if (!crossingsYd.some((c) => Math.abs(c - zeroYd) < 1)) {
    crossingsYd.push(zeroYd);
    crossingsYd.sort((a, b) => a - b);
  }
  const far = crossingsYd[1];
  const rawMax = Math.max(zeroYd * 1.5, targetYd * 1.3, far ? far * 1.15 : zeroYd * 2, 100);
  const chartMaxYd = Math.min(Math.ceil(rawMax / 25) * 25, 600);

  const step = chartMaxYd <= 150 ? 1 : chartMaxYd <= 300 ? 2 : 5;
  const ranges: number[] = [];
  for (let r = 0; r <= chartMaxYd; r += step) ranges.push(r);
  const trajectory = sampleTrajectory(input, elevation, ranges);

  let apex: ZeroResult["apex"] = null;
  if (crossingsYd.length >= 2) {
    const top = trajectory.reduce((best, p) => (p.heightIn > best.heightIn ? p : best), trajectory[0]);
    apex = { rangeYd: top.rangeYd, heightIn: top.heightIn };
  }

  return {
    resolved,
    input,
    elevationRad: elevation,
    offsetIn,
    offsetMoa: offsetIn / moaInches(targetYd),
    offsetMil: offsetIn / milInches(targetYd),
    crossingsYd: crossingsYd.slice(0, 2),
    apex,
    trajectory,
    chartMaxYd,
    sensitivity: {
      targetPlus1Yd: (atTargetPlus1?.heightIn ?? offsetIn) - offsetIn,
      mvMinus100Fps: offsetFor({ ...input, muzzleVelocityFps: input.muzzleVelocityFps - 100 }, zeroYd, targetYd) - offsetIn,
      sightHeightPlusTenth: offsetFor({ ...input, sightHeightIn: input.sightHeightIn + 0.1 }, zeroYd, targetYd) - offsetIn,
    },
  };
}
