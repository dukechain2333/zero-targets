import { describe, expect, it } from "vitest";
import { BARREL_PRESETS_BY_GROUP } from "./ammo-data";
import { estimateMuzzleVelocity, LOADS } from "./ammo";
import { computeZero } from "./compute";
import { DEFAULT_SETUP } from "./setup";

describe("ammo data", () => {
  it("has unique ids and sorted velocity curves", () => {
    expect(new Set(LOADS.map((l) => l.id)).size).toBe(LOADS.length);
    for (const l of LOADS) {
      for (let i = 1; i < l.mvByBarrel.length; i++) expect(l.mvByBarrel[i][0]).toBeGreaterThan(l.mvByBarrel[i - 1][0]);
      expect(BARREL_PRESETS_BY_GROUP[l.group], l.group).toBeDefined();
      expect(l.sources.length).toBeGreaterThan(0);
    }
  });

  it("interpolates between measured barrel lengths", () => {
    const m193 = LOADS.find((l) => l.id === "m193")!;
    expect(estimateMuzzleVelocity(m193, 14.5)).toEqual({ fps: 3050, extrapolated: false });
    expect(estimateMuzzleVelocity(m193, 15.25).fps).toBeCloseTo(3080, 5);
    expect(estimateMuzzleVelocity(m193, 22).extrapolated).toBe(true);
  });

  // Subsonic loads climb steeply to a 50 yd zero and sit close to the sight line at 25 yd.
  it("gives a sane 25 yd offset for a 50 yd zero with every load and preset barrel", () => {
    for (const l of LOADS) {
      for (const barrelIn of BARREL_PRESETS_BY_GROUP[l.group]) {
        const r = computeZero({ ...DEFAULT_SETUP, loadId: l.id, barrelIn, railToBoreIn: l.platform === "ar10" ? 1.3 : 1.21 });
        expect(r.offsetIn, `${l.id} ${barrelIn}`).toBeLessThan(0);
        expect(r.offsetIn, `${l.id} ${barrelIn}`).toBeGreaterThan(-2.5);
      }
    }
  });
});
