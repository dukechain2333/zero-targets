import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/py-ballisticcalc.json";
import { lineOfSightCrossings, sampleTrajectory, solveZeroElevation, type DragModel } from "./solver";

// Reference values come from py-ballisticcalc 2.3 (RK4 engine, ICAO atmosphere).
const reference = fixture as unknown as { name: string; bc: number; dragModel: string; muzzleVelocityFps: number; sightHeightIn: number; zeroYd: number; heightsIn: Record<string, number> }[];

describe("solver matches py-ballisticcalc", () => {
  for (const c of reference) {
    it(c.name, () => {
      const input = { ...c, dragModel: c.dragModel as DragModel };
      const elevation = solveZeroElevation(input, c.zeroYd);
      const ranges = Object.keys(c.heightsIn).map(Number).sort((a, b) => a - b);
      const pts = sampleTrajectory(input, elevation, ranges);
      for (const p of pts) {
        const expected = c.heightsIn[String(p.rangeYd)];
        // 0.01 in at short range; allow a little more far out where drop is large.
        const tol = p.rangeYd <= 100 ? 0.01 : 0.03;
        expect(Math.abs(p.heightIn - expected), `${p.rangeYd} yd`).toBeLessThan(tol);
      }
    });
  }
});

describe("zero geometry", () => {
  const input = { muzzleVelocityFps: 2970, bc: 0.243, dragModel: "G1" as const, sightHeightIn: 2.75 };

  it("puts the bullet on the line of sight at the zero range", () => {
    const e = solveZeroElevation(input, 50);
    const [p] = sampleTrajectory(input, e, [50]);
    expect(Math.abs(p.heightIn)).toBeLessThan(1e-4);
  });

  it("finds the near and far crossings of a 50 yd zero", () => {
    const e = solveZeroElevation(input, 50);
    const [near, far] = lineOfSightCrossings(input, e, 400);
    expect(near).toBeCloseTo(50, 1);
    expect(far).toBeGreaterThan(180);
    expect(far).toBeLessThan(240);
  });

  it("starts the bullet one sight height below the line of sight", () => {
    const [p] = sampleTrajectory(input, 0.001, [0]);
    expect(p.heightIn).toBeCloseTo(-2.75, 6);
  });
});
