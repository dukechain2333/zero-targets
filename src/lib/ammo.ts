import type { DragModel } from "./ballistics/solver";
import { AMMO_DATA, BARREL_PRESETS_BY_GROUP, TABLE_RANGE_BY_GROUP } from "./ammo-data";
import type { MvCurve } from "./mv-curve";
import { BARREL_PRESETS, type Preset } from "./presets";

export { estimateMuzzleVelocity, type MvEstimate } from "./mv-curve";

export interface Load {
  id: string;
  /** Caliber group used for the picker, e.g. "5.56 NATO / .223 Rem". */
  group: string;
  /** Maker, for factory loads; generic and military-spec loads have none. */
  brand?: string;
  name: string;
  /** Product codes printed on the box (e.g. "AE223"), so a search for them finds the load. */
  sku?: string[];
  /**
   * For a factory load that is the app's data for a common type (e.g. Federal Gold Medal 168 gr for
   * ".308 168 gr match"): its name in the picker's Standard view.
   */
  standard?: string;
  /** The standard load (id) this factory load is made to, e.g. an M193 or 124 gr FMJ load. */
  sameAs?: string;
  /** Compact name for the printed target header. */
  short: string;
  weightGr: number;
  diameterIn: number;
  bc: number;
  dragModel: DragModel;
  /** Measured or published (barrel length in, muzzle velocity fps) points, ascending by length. */
  mvByBarrel: MvCurve;
  /** Which upper the load is normally fired from, for the default rail-to-bore height. */
  platform: "ar15" | "ar10";
  /** How much of the velocity curve is measured (high) rather than estimated (low). */
  confidence: "high" | "medium" | "low";
  notes: string;
  sources: { label: string; url?: string }[];
}

// Within a caliber: generic and military loads first, in catalog order, then factory loads by brand and weight.
const GROUP_ORDER = [...new Set(AMMO_DATA.map((l) => l.group))];
export const LOADS: Load[] = [...AMMO_DATA].sort(
  (a, b) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
    Number(a.brand != null) - Number(b.brand != null) ||
    (a.brand && b.brand ? a.brand.localeCompare(b.brand) || a.weightGr - b.weightGr || a.name.localeCompare(b.name) : 0),
);

export const DEFAULT_LOAD_ID = "m193";

export const getLoad = (id: string) => LOADS.find((l) => l.id === id);

/**
 * The picker's two views. Standard: generic and military-spec loads and the factory loads that stand in
 * for a type, as picked by someone who knows "M855" but not the brand. Brand: every factory load.
 */
export type LoadView = "standard" | "brand";

export const inView = (l: Load, view: LoadView) => (view === "standard" ? !l.brand || l.standard != null : l.brand != null);

/** A load's name in the Standard view. */
export const standardName = (l: Load) => l.standard ?? l.name;

/** Factory loads made to a standard load, e.g. Federal XM193 and PMC X-TAC for M193. */
export const followersOf = (id: string) => LOADS.filter((l) => l.sameAs === id);

export function loadGroups(): { group: string; loads: Load[] }[] {
  const groups = new Map<string, Load[]>();
  for (const l of LOADS) groups.set(l.group, [...(groups.get(l.group) ?? []), l]);
  return [...groups].map(([group, loads]) => ({ group, loads }));
}

// Other names people type for each caliber group.
const GROUP_ALIASES: Record<string, string> = {
  "5.56 NATO / .223 Rem": "5.56x45 223 remington ar15 ar-15",
  ".300 AAC Blackout": "300 blk 300blk 300 blackout 7.62x35 whisper",
  "9mm Luger (carbine)": "9x19 parabellum pcc pistol caliber",
  "7.62x39": "ak ak47 ak-47 sks",
  ".308 Win / 7.62x51 NATO": "308 winchester 7.62 nato ar10 ar-10",
  "6.5 Creedmoor": "6.5cm 6.5 cm 65cm creed",
};

// Lowercase, drop dots and hyphens inside words, so "5.56", "556" and ".223" or "V-MAX" and "vmax"
// find the same loads.
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/(?<=[a-z])-(?=[a-z])/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// A word matches where a run of letters or digits starts: "855" finds "m855", "62" does not find "262".
const wordPattern = (w: string) => new RegExp(/^[0-9]/.test(w) ? `(?<![0-9])${w}` : `(?<![a-z])${w}`);

const ownText = (l: Load) =>
  `${l.brand ?? ""} ${l.name} ${l.standard ?? ""} ${l.short} ${l.sku?.join(" ") ?? ""} ${l.weightGr}gr ${l.dragModel}`;

const haystacks = new Map(LOADS.map((l) => [l.id, normalize(`${l.group} ${GROUP_ALIASES[l.group] ?? ""} ${ownText(l)}`)]));

// In the Standard view a type also answers to the factory loads made to it, so "XM855" finds M855.
const standardHaystacks = new Map(
  LOADS.map((l) => [l.id, `${haystacks.get(l.id)} ${normalize(followersOf(l.id).map(ownText).join(" "))}`]),
);

/**
 * Loads whose caliber, brand, name, product code or weight contain every word of the query, in catalog
 * order; limited to one picker view when given.
 */
export function searchLoads(query: string, view?: LoadView): Load[] {
  const patterns = normalize(query).split(" ").filter(Boolean).map(wordPattern);
  const pool = view ? LOADS.filter((l) => inView(l, view)) : LOADS;
  if (!patterns.length) return pool;
  const hay = view === "standard" ? standardHaystacks : haystacks;
  return pool.filter((l) => {
    const h = hay.get(l.id)!;
    return patterns.every((p) => p.test(h));
  });
}

/** Barrel lengths that are common for the load's caliber. */
export function barrelPresetsFor(load: Load | null): Preset[] {
  const lengths = load ? BARREL_PRESETS_BY_GROUP[load.group] : undefined;
  return lengths ? lengths.map((v) => ({ value: v, label: String(v) })) : BARREL_PRESETS;
}

/** A sensible longest range for the ballistic card and table, yards. */
export function defaultTableRangeYd(load: Load | null, muzzleVelocityFps: number): number {
  if (muzzleVelocityFps < 1150) return load?.group.startsWith("9mm") ? 150 : 200;
  if (!load) return muzzleVelocityFps < 2000 ? 300 : 500;
  return TABLE_RANGE_BY_GROUP[load.group] ?? 500;
}
