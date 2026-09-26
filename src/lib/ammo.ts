import type { DragModel } from "./ballistics/solver";
import { AMMO_DATA, BARREL_PRESETS_BY_GROUP, TABLE_RANGE_BY_GROUP } from "./ammo-data";
import { BARREL_PRESETS, type Preset } from "./presets";

export interface Load {
  id: string;
  /** Caliber group used for the picker, e.g. "5.56 NATO / .223 Rem". */
  group: string;
  name: string;
  /** Compact name for the printed target header. */
  short: string;
  weightGr: number;
  diameterIn: number;
  bc: number;
  dragModel: DragModel;
  /** Measured or published (barrel length in, muzzle velocity fps) points, ascending by length. */
  mvByBarrel: ReadonlyArray<readonly [number, number]>;
  /** Which upper the load is normally fired from, for the default rail-to-bore height. */
  platform: "ar15" | "ar10";
  /** How much of the velocity curve is measured (high) rather than estimated (low). */
  confidence: "high" | "medium" | "low";
  notes: string;
  sources: { label: string; url?: string }[];
}

export const LOADS: Load[] = AMMO_DATA;

export const DEFAULT_LOAD_ID = "m193";

export const getLoad = (id: string) => LOADS.find((l) => l.id === id);

export function loadGroups(): { group: string; loads: Load[] }[] {
  const groups = new Map<string, Load[]>();
  for (const l of LOADS) groups.set(l.group, [...(groups.get(l.group) ?? []), l]);
  return [...groups].map(([group, loads]) => ({ group, loads }));
}

export interface MvEstimate {
  fps: number;
  /** True when the barrel is shorter or longer than the published data covers. */
  extrapolated: boolean;
}

/**
 * Muzzle velocity for a barrel length: linear interpolation between published points. Outside the
 * data the end segment's slope is extended, which is a fair guess for a couple of inches but no more.
 */
export function estimateMuzzleVelocity(load: Pick<Load, "mvByBarrel">, barrelIn: number): MvEstimate {
  const pts = load.mvByBarrel;
  if (pts.length === 1) return { fps: pts[0][1], extrapolated: barrelIn !== pts[0][0] };
  let i = pts.findIndex(([len]) => len >= barrelIn);
  const extrapolated = i === -1 || (i === 0 && barrelIn < pts[0][0]);
  if (i === -1) i = pts.length - 1;
  if (i === 0) i = 1;
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  const fps = y0 + ((barrelIn - x0) * (y1 - y0)) / (x1 - x0);
  // Steep short-barrel slopes can run away when extended; never drop below 60% of the data.
  return { fps: Math.max(fps, 0.6 * pts[0][1]), extrapolated };
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
