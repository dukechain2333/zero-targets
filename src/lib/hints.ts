// Small "what this choice leads to" labels under the zero and target-distance chips.

import { lineOfSightCrossings, sampleTrajectory, solveZeroElevation } from "./ballistics/solver";
import type { ZeroResult } from "./compute";
import { distanceToDisplay, MM_PER_IN, type UnitSystem } from "./units";

/** Peaks lower than this count as "the bullet only touches the sight line". */
const TANGENT_IN = 0.25;

/**
 * For each candidate zero distance: where the bullet crosses the sight line the other time, or
 * "peak" when the zero sits at the top of the arc.
 */
export function zeroHints(result: ZeroResult, zeroYds: number[], units: UnitSystem): Map<number, string> {
  const hints = new Map<number, string>();
  for (const zeroYd of zeroYds) {
    const elevation = solveZeroElevation(result.input, zeroYd);
    const crossings = lineOfSightCrossings(result.input, elevation, 1000, 2);
    const other = crossings.find((c) => Math.abs(c - zeroYd) > 3);
    let hint = "–";
    if (other != null) {
      const [a, b] = [Math.min(other, zeroYd), Math.max(other, zeroYd)];
      const mid = sampleTrajectory(result.input, elevation, [(a + b) / 2])[0];
      hint = mid && mid.heightIn < TANGENT_IN ? "peak" : String(Math.round(distanceToDisplay(other, units)));
    } else if (crossings.length > 0) {
      hint = "peak";
    }
    hints.set(zeroYd, hint);
  }
  return hints;
}

/** For each candidate target distance: where the group should land relative to the aim point. */
export function targetHints(result: ZeroResult, targetYds: number[], units: UnitSystem): Map<number, string> {
  const sorted = [...targetYds].sort((a, b) => a - b);
  const pts = sampleTrajectory(result.input, result.elevationRad, sorted);
  const hints = new Map<number, string>();
  pts.forEach((p) => {
    const v = units === "metric" ? p.heightIn * MM_PER_IN : p.heightIn;
    const text = units === "metric" ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(2);
    const zero = Number(text) === 0;
    hints.set(p.rangeYd, zero ? text : `${v < 0 ? "−" : "+"}${text}`);
  });
  return hints;
}
