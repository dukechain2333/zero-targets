import { describe, expect, it } from "vitest";
import conditionsFixture from "./__fixtures__/py-ballisticcalc-conditions.json";
import fixture from "./__fixtures__/py-ballisticcalc.json";
import { atmosphereAt, lineOfSightCrossings, sampleTrajectory, solveZeroElevation, type DragModel } from "./solver";

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

// Wind drift and non-standard air, also from py-ballisticcalc (10-15 mph full-value crosswind).
const conditions = conditionsFixture as unknown as {
  name: string;
  bc: number;
  dragModel: string;
  muzzleVelocityFps: number;
  sightHeightIn: number;
  zeroYd: number;
  altitudeFt: number;
  temperatureF: number;
  windMph: number;
  heightsIn: Record<string, number>;
  windageIn: Record<string, number>;
  velocityFps: Record<string, number>;
}[];

describe("wind and atmosphere match py-ballisticcalc", () => {
  for (const c of conditions) {
    it(c.name, () => {
      const input = {
        muzzleVelocityFps: c.muzzleVelocityFps,
        bc: c.bc,
        dragModel: c.dragModel as DragModel,
        sightHeightIn: c.sightHeightIn,
        atmosphere: atmosphereAt(c.altitudeFt, c.temperatureF),
      };
      const elevation = solveZeroElevation(input, c.zeroYd);
      const ranges = Object.keys(c.heightsIn).map(Number).sort((a, b) => a - b);
      const still = sampleTrajectory(input, elevation, ranges);
      const windy = sampleTrajectory({ ...input, crosswindMph: c.windMph }, elevation, ranges);
      // Allow 0.5% of the value (the reference re-evaluates drag once per step, this solver per RK stage).
      const tol = (v: number) => Math.max(0.03, Math.abs(v) * 0.005);
      still.forEach((p, i) => {
        const r = String(p.rangeYd);
        expect(Math.abs(p.heightIn - c.heightsIn[r]), `height ${r} yd`).toBeLessThan(tol(c.heightsIn[r]));
        expect(Math.abs(p.velocityFps - c.velocityFps[r]), `velocity ${r} yd`).toBeLessThan(3);
        expect(Math.abs(Math.abs(windy[i].windageIn) - Math.abs(c.windageIn[r])), `windage ${r} yd`).toBeLessThan(tol(c.windageIn[r]));
      });
    });
  }

  it("drifts downwind: wind from the left pushes the bullet right", () => {
    const input = { muzzleVelocityFps: 3000, bc: 0.25, dragModel: "G1" as const, sightHeightIn: 2.6, crosswindMph: 10 };
    const [p] = sampleTrajectory(input, 0.002, [300]);
    expect(p.windageIn).toBeGreaterThan(5);
  });

  it("thins the air with altitude", () => {
    expect(atmosphereAt(0, 59).densityRatio).toBeCloseTo(1, 4);
    expect(atmosphereAt(5000, 41).densityRatio).toBeCloseTo(0.862, 2);
  });
});
