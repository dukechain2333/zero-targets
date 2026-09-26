import { describe, expect, it } from "vitest";
import { buildBallisticTable } from "./ballistic-table";
import { computeZero } from "./compute";
import { DEFAULT_SETUP, setupFromQuery, setupToQuery, type Setup } from "./setup";
import { buildBallisticsDoc } from "./target/ballistics-pages";

const tableFor = (s: Setup) => buildBallisticTable(s, computeZero(s));

describe("ballistic table", () => {
  it("steps out to the max range and corrects upward for a low bullet", () => {
    const t = tableFor(DEFAULT_SETUP);
    expect(t.rows.map((r) => r.rangeYd)).toEqual(Array.from({ length: 20 }, (_, i) => (i + 1) * 25));
    const at50 = t.rows.find((r) => r.rangeYd === 50)!;
    expect(Math.abs(at50.pathIn)).toBeLessThan(1e-3);
    const at400 = t.rows.find((r) => r.rangeYd === 400)!;
    expect(at400.pathIn).toBeLessThan(-15);
    expect(at400.elevation).toBeGreaterThan(0);
    expect(at400.elevationClicks).toBe(Math.round(at400.elevation / 0.5));
    expect(at400.windIn).toBeGreaterThan(at400.rangeYd / 100);
  });

  it("keeps quick-card rows short enough for a wallet card", () => {
    for (const tableMaxYd of [100, 300, 500, 1000]) {
      const t = tableFor({ ...DEFAULT_SETUP, tableMaxYd });
      expect(t.cardRows.length).toBeGreaterThan(0);
      expect(t.cardRows.length).toBeLessThanOrEqual(12);
    }
  });

  it("uses whole metres in metric", () => {
    const t = tableFor({ ...DEFAULT_SETUP, units: "metric", tableMaxYd: 300 / 0.9144, tableStepYd: 50 / 0.9144 });
    expect(t.rows.map((r) => Math.round(r.rangeYd * 0.9144 * 1000) / 1000)).toEqual([50, 100, 150, 200, 250, 300]);
  });

  it("finds where a supersonic load goes subsonic", () => {
    const t = tableFor({ ...DEFAULT_SETUP, loadId: "9mm-115", barrelIn: 16 });
    expect(t.subsonicYd).toBeGreaterThan(10);
    expect(t.subsonicYd).toBeLessThan(150);
    expect(tableFor({ ...DEFAULT_SETUP, loadId: "blk-220-sub", barrelIn: 16 }).subsonicYd).toBeNull();
  });

  it("builds a cards page and enough table pages", () => {
    const s = { ...DEFAULT_SETUP, tableMaxYd: 1000, tableStepYd: 10 };
    const r = computeZero(s);
    const doc = buildBallisticsDoc(s, r, buildBallisticTable(s, r), { cards: true, table: true });
    expect(doc.pages[0].label).toBe("Cards");
    expect(doc.pages.length).toBeGreaterThanOrEqual(4);
    expect(buildBallisticsDoc(s, r, buildBallisticTable(s, r), { cards: false, table: false }).pages).toHaveLength(0);
  });

  it("round-trips the table settings through the URL", () => {
    const s = { ...DEFAULT_SETUP, tableMaxYd: 800, tableStepYd: 50 };
    expect(setupFromQuery(setupToQuery(s))).toEqual(s);
  });
});
