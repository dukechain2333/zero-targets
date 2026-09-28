import { describe, expect, it } from "vitest";
import { BARREL_PRESETS_BY_GROUP } from "./ammo-data";
import { estimateMuzzleVelocity, getLoad, inView, LOADS, searchLoads } from "./ammo";
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

  it("has a velocity curve that rises with barrel length for every load", () => {
    for (const l of LOADS) {
      const v = l.mvByBarrel;
      for (let i = 1; i < v.length; i++) expect(v[i][1], `${l.id} at ${v[i][0]} in`).toBeGreaterThanOrEqual(v[i - 1][1]);
    }
  });

  it("names every factory load after its maker", () => {
    for (const l of LOADS) if (l.brand) expect(l.name.startsWith(l.brand.split(" ")[0]), l.id).toBe(true);
  });

  it("interpolates between measured barrel lengths", () => {
    const m193 = LOADS.find((l) => l.id === "m193")!;
    expect(estimateMuzzleVelocity(m193, 14.5)).toEqual({ fps: 3050, extrapolated: false });
    expect(estimateMuzzleVelocity(m193, 15.25).fps).toBeCloseTo(3080, 5);
    expect(estimateMuzzleVelocity(m193, 22).extrapolated).toBe(true);
  });

  // Subsonic loads climb steeply to a 50 yd zero and sit close to the sight line at 25 yd; the
  // slowest (under ~900 fps from a short barrel) even arc slightly above it.
  it("gives a sane 25 yd offset for a 50 yd zero with every load and preset barrel", () => {
    for (const l of LOADS) {
      for (const barrelIn of BARREL_PRESETS_BY_GROUP[l.group]) {
        const r = computeZero({ ...DEFAULT_SETUP, loadId: l.id, barrelIn, railToBoreIn: l.platform === "ar10" ? 1.3 : 1.21 });
        expect(r.offsetIn, `${l.id} ${barrelIn}`).toBeLessThan(r.resolved.muzzleVelocityFps < 1000 ? 0.5 : 0);
        expect(r.offsetIn, `${l.id} ${barrelIn}`).toBeGreaterThan(-2.5);
      }
    }
  });
});

describe("load search", () => {
  const ids = (q: string) => searchLoads(q).map((l) => l.id);

  it("returns everything for an empty query", () => {
    expect(searchLoads("  ")).toHaveLength(LOADS.length);
  });

  it("matches calibers written in different ways", () => {
    for (const q of ["5.56", "556", ".223", "223 rem"]) expect(ids(q), q).toContain("m193");
    for (const q of ["300 blk", "300blk", "blackout"]) expect(ids(q), q).toContain("blk-110-vmax");
    for (const q of ["6.5 cm", "creedmoor", "65cm"]) {
      expect(ids(q), q).toContain("65cm-140-eldm");
      expect(new Set(searchLoads(q).map((l) => l.group)), q).toEqual(new Set(["6.5 Creedmoor"]));
    }
  });

  it("needs every word to match, in any order", () => {
    expect(ids("62 gr 5.56")).toEqual(expect.arrayContaining(["m855", "m855a1", "fusion-62"]));
    expect(ids("62 gr 5.56")).not.toContain("mk262");
    expect(ids("m855a1")).toEqual(["m855a1"]);
    expect(ids("855")).toEqual(expect.arrayContaining(["m855", "m855a1"]));
    expect(searchLoads("subsonic 300").every((l) => l.group === ".300 AAC Blackout" && /subsonic/i.test(l.name))).toBe(true);
    expect(ids("nothing like this")).toEqual([]);
  });

  it("finds factory loads by brand and by the code on the box", () => {
    expect(ids("hornady 147 eld")).toEqual(["hdy-65cm-147-eldm"]);
    expect(ids("gm308m2")).toEqual(["gmm-175"]);
    expect(ids("federal 300 blk 150")).toEqual(expect.arrayContaining(["blk-150-fmj", "fed-blk-fusion-150"]));
    expect(ids("vmax")).toContain("blk-110-vmax");
    expect(ids("sellier 308")).toEqual(["sb-308-147-fmj"]);
  });
});

describe("picker views", () => {
  const ids = (q: string, view: "standard" | "brand") => searchLoads(q, view).map((l) => l.id);

  it("keeps every load of the original catalog in the Standard view", () => {
    const original = ["m193", "m855", "m855a1", "mk262", "75-bthp", "fusion-62", "gmm-69", "blk-110-vmax", "blk-110-tactx",
      "blk-125-otm", "blk-150-fmj", "blk-220-sub", "9mm-115", "9mm-124", "9mm-147", "762x39-123", "m80", "gmm-168",
      "gmm-175", "65cm-140-eldm"];
    expect(ids("", "standard")).toEqual(expect.arrayContaining(original));
  });

  it("puts every factory load in the Brand view and generic ones only in Standard", () => {
    for (const l of LOADS) {
      expect(inView(l, "brand"), l.id).toBe(l.brand != null);
      if (!l.brand) expect(inView(l, "standard"), l.id).toBe(true);
    }
  });

  it("links factory loads to a generic load of the same caliber", () => {
    for (const l of LOADS.filter((x) => x.sameAs)) {
      const std = getLoad(l.sameAs!);
      expect(std, l.id).toBeDefined();
      expect(std!.brand, l.id).toBeUndefined();
      expect(std!.group, l.id).toBe(l.group);
    }
  });

  it("finds a standard type by the brands and box codes made to it", () => {
    expect(ids("xm855", "standard")).toEqual(["m855"]);
    expect(ids("xm855", "brand")).toEqual(["fed-xm855"]);
    expect(ids("m855", "standard")).toEqual(expect.arrayContaining(["m855", "m855a1"]));
    expect(ids("blazer", "standard")).toEqual(["9mm-115", "9mm-124"]);
  });
});

