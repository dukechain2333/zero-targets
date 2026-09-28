import { describe, expect, it } from "vitest";
import { cleanSeries, estimateMuzzleVelocity, fitCurve } from "./mv-curve";

const SHAPE = [
  [10, 2700],
  [14, 2900],
  [16, 2980],
  [18, 3040],
  [20, 3100],
] as const;

describe("fitCurve", () => {
  it("scales a measured curve through a point inside it", () => {
    const c = fitCurve(SHAPE, [[16, 2890]]);
    expect(c).toHaveLength(SHAPE.length);
    expect(estimateMuzzleVelocity({ mvByBarrel: c }, 16).fps).toBe(2890);
    expect(c[0]).toEqual([10, 2620]); // 2700 x 2890/2980, rounded to 5 fps
  });

  it("adds a factory test barrel beyond the data and extends the last four inches' slope to reach it", () => {
    // Slope 16..20 in is 30 fps/in, so the shape reads 3220 at 24 in; a 3240 fps spec scales it up slightly.
    const c = fitCurve(SHAPE, [[24, 3240]]);
    expect(c[c.length - 1]).toEqual([24, 3240]);
    expect(c[c.length - 2]).toEqual([20, 3120]);
    expect(estimateMuzzleVelocity({ mvByBarrel: c }, 24).extrapolated).toBe(false);
  });

  it("handles a point shorter than the data", () => {
    const c = fitCurve(SHAPE, [[8, 2500]]);
    expect(c[0]).toEqual([8, 2500]);
    expect(c.every(([, v], i) => i === 0 || v > c[i - 1][1])).toBe(true);
  });

  it("uses the median ratio of several points", () => {
    // Ratios 1.00, 0.98 and 0.90: the median 0.98 ignores the outlier.
    const c = fitCurve(SHAPE, [[14, 2900], [16, 2920], [20, 2790]]);
    expect(c.find(([len]) => len === 16)).toEqual([16, 2920]);
  });
});

describe("cleanSeries", () => {
  it("pools readings that drop with a longer barrel and extends the ends", () => {
    const c = cleanSeries([[17, 2650], [18, 2665], [19, 2690], [20, 2730], [21, 2745], [22, 2800], [23, 2796], [24, 2808]], [16, 26]);
    expect(c.find(([len]) => len === 22)).toEqual([22, 2800]); // 2800 and 2796 pooled to 2798
    expect(c.find(([len]) => len === 23)).toEqual([23, 2800]);
    expect(c[0][0]).toBe(16);
    expect(c[0][1]).toBeLessThan(2650);
    expect(c[c.length - 1][0]).toBe(26);
    expect(c.every(([, v], i) => i === 0 || v >= c[i - 1][1])).toBe(true);
  });

  it("extends along a similar load's curve when given one", () => {
    // SHAPE loses 200 fps from 14 to 10 in (6.9%); the extension keeps that ratio.
    const c = cleanSeries([[14, 2800], [16, 2880], [18, 2940]], [10], SHAPE);
    expect(c[0]).toEqual([10, 2605]); // 2800 x 2700/2900 = 2606.9, rounded to 5 fps
  });
});
