import { describe, expect, it } from "vitest";
import { computeZero } from "../compute";
import { buildGuide } from "../guide";
import { DEFAULT_SETUP, setupFromQuery, setupToQuery } from "../setup";
import { buildTargetScene, gridSpec } from "./scene";

describe("target scene", () => {
  it("places IMPACT below AIM by the computed offset", () => {
    const result = computeZero(DEFAULT_SETUP);
    const scene = buildTargetScene(DEFAULT_SETUP, result);
    const texts = scene.prims.filter((p) => p.t === "text");
    const aim = texts.find((p) => p.text === "AIM")!;
    const impact = texts.find((p) => p.text === "IMPACT")!;
    expect(result.offsetIn).toBeLessThan(0);
    expect(impact.y).toBeGreaterThan(aim.y);
    expect(scene.fits).toBe(true);
  });

  it("anchors a grid line on IMPACT", () => {
    const result = computeZero(DEFAULT_SETUP);
    const scene = buildTargetScene(DEFAULT_SETUP, result);
    const red = scene.prims.find((p) => p.t === "line" && p.color === "#d90d0d" && p.y1 === p.y2);
    const dot = scene.prims.find((p) => p.t === "circle" && p.r === 0.028);
    expect(red && dot && red.t === "line" && dot.t === "circle" && Math.abs(red.y1 - dot.cy)).toBeLessThan(1e-9);
  });

  it("picks 1 MOA squares at 25 yd and 0.25 MOA at 100 yd", () => {
    expect(gridSpec("moa", 25).step).toBe(1);
    expect(gridSpec("moa", 100).step).toBe(0.25);
    expect(gridSpec("mil", 25 / 0.9144).step).toBe(0.2);
  });

  it("builds a guide", () => {
    const result = computeZero(DEFAULT_SETUP);
    const scene = buildTargetScene(DEFAULT_SETUP, result);
    const guide = buildGuide(DEFAULT_SETUP, result, scene.grid);
    expect(guide.steps.length).toBeGreaterThan(4);
  });
});

describe("url state", () => {
  it("round-trips a custom setup", () => {
    const s = { ...DEFAULT_SETUP, units: "metric" as const, barrelIn: 10.3, zeroYd: 100 / 0.9144, targetYd: 25 / 0.9144, mvOverrideFps: 2750 };
    const back = setupFromQuery(setupToQuery(s));
    expect(back.barrelIn).toBe(10.3);
    expect(back.zeroYd).toBeCloseTo(s.zeroYd, 5);
    expect(back.targetYd).toBeCloseTo(s.targetYd, 5);
    expect(back.mvOverrideFps).toBe(2750);
    expect(back.units).toBe("metric");
  });

  it("ignores garbage", () => {
    const s = setupFromQuery("barrel=abc&zero=-5&ammo=nope");
    expect(s.barrelIn).toBe(DEFAULT_SETUP.barrelIn);
    expect(s.zeroYd).toBe(5);
    expect(s.loadId).toBe(DEFAULT_SETUP.loadId);
  });
});
