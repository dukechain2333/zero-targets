import { DEFAULT_LOAD_ID, estimateMuzzleVelocity, getLoad, type Load } from "./ammo";
import type { DragModel } from "./ballistics/solver";
import {
  CLICK_PRESETS,
  PAPER_SIZES,
  RAIL_TO_BORE_PRESETS,
  type ClickPreset,
  type PaperSize,
} from "./presets";
import type { UnitSystem } from "./units";

export const CUSTOM_LOAD_ID = "custom";

export interface CustomLoad {
  weightGr: number;
  bc: number;
  dragModel: DragModel;
}

export interface Setup {
  units: UnitSystem;
  loadId: string;
  customLoad: CustomLoad;
  barrelIn: number;
  /** Chronographed muzzle velocity; null = estimate from load + barrel length. */
  mvOverrideFps: number | null;
  opticHeightIn: number;
  railToBoreIn: number;
  zeroYd: number;
  targetYd: number;
  paperId: string;
  /** Turret click value; also picks the target grid (MOA or MIL). */
  clickId: string;
}

export const DEFAULT_SETUP: Setup = {
  units: "imperial",
  loadId: DEFAULT_LOAD_ID,
  customLoad: { weightGr: 55, bc: 0.243, dragModel: "G1" },
  barrelIn: 14.5,
  mvOverrideFps: null,
  opticHeightIn: 1.535,
  railToBoreIn: RAIL_TO_BORE_PRESETS[0].value,
  zeroYd: 50,
  targetYd: 25,
  paperId: "letter",
  clickId: "0.5moa",
};

export const LIMITS = {
  barrelIn: [2, 34],
  opticHeightIn: [0, 4],
  railToBoreIn: [0, 3],
  zeroYd: [5, 1000],
  targetYd: [3, 300],
  mvFps: [300, 4500],
  bc: [0.02, 1.5],
  weightGr: [10, 800],
} as const satisfies Record<string, readonly [number, number]>;

export const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------- derived values

export interface ResolvedSetup {
  load: Load | null;
  loadName: string;
  loadShort: string;
  bc: number;
  dragModel: DragModel;
  muzzleVelocityFps: number;
  mvSource: "estimated" | "extrapolated" | "measured";
  sightHeightIn: number;
  paper: PaperSize;
  click: ClickPreset;
}

export function resolveSetup(s: Setup): ResolvedSetup {
  const load = s.loadId === CUSTOM_LOAD_ID ? null : (getLoad(s.loadId) ?? getLoad(DEFAULT_LOAD_ID)!);
  const bc = load ? load.bc : s.customLoad.bc;
  const dragModel = load ? load.dragModel : s.customLoad.dragModel;

  let muzzleVelocityFps: number;
  let mvSource: ResolvedSetup["mvSource"];
  if (s.mvOverrideFps != null || !load) {
    muzzleVelocityFps = s.mvOverrideFps ?? 2900;
    mvSource = "measured";
  } else {
    const est = estimateMuzzleVelocity(load, s.barrelIn);
    muzzleVelocityFps = est.fps;
    mvSource = est.extrapolated ? "extrapolated" : "estimated";
  }

  return {
    load,
    loadName: load ? `${load.name} (${load.group})` : `Custom ${s.customLoad.weightGr} gr, ${s.customLoad.dragModel} BC ${s.customLoad.bc}`,
    loadShort: load ? load.short : `${s.customLoad.weightGr} gr custom load`,
    bc,
    dragModel,
    muzzleVelocityFps,
    mvSource,
    sightHeightIn: s.opticHeightIn + s.railToBoreIn,
    paper: PAPER_SIZES.find((p) => p.id === s.paperId) ?? PAPER_SIZES[0],
    click: CLICK_PRESETS.find((c) => c.id === s.clickId) ?? CLICK_PRESETS[0],
  };
}

// ---------------------------------------------------------------- URL state

type ParamCodec = { key: string; get: (s: Setup) => string | null; set: (s: Setup, v: string) => Setup };

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const CODECS: ParamCodec[] = [
  { key: "u", get: (s) => s.units, set: (s, v) => (v === "metric" || v === "imperial" ? { ...s, units: v } : s) },
  { key: "ammo", get: (s) => s.loadId, set: (s, v) => (v === CUSTOM_LOAD_ID || getLoad(v) ? { ...s, loadId: v } : s) },
  {
    key: "bullet",
    get: (s) =>
      s.loadId === CUSTOM_LOAD_ID ? `${s.customLoad.weightGr}-${s.customLoad.bc}-${s.customLoad.dragModel}` : null,
    set: (s, v) => {
      const [w, bc, dm] = v.split("-");
      const weightGr = num(w);
      const bcN = num(bc);
      if (weightGr == null || bcN == null || (dm !== "G1" && dm !== "G7")) return s;
      return {
        ...s,
        customLoad: { weightGr: clamp(weightGr, LIMITS.weightGr), bc: clamp(bcN, LIMITS.bc), dragModel: dm },
      };
    },
  },
  { key: "barrel", get: (s) => String(s.barrelIn), set: (s, v) => withNum(s, v, "barrelIn", LIMITS.barrelIn) },
  {
    key: "mv",
    get: (s) => (s.mvOverrideFps == null ? null : String(Math.round(s.mvOverrideFps))),
    set: (s, v) => {
      const n = num(v);
      return n == null ? s : { ...s, mvOverrideFps: clamp(n, LIMITS.mvFps) };
    },
  },
  { key: "optic", get: (s) => String(s.opticHeightIn), set: (s, v) => withNum(s, v, "opticHeightIn", LIMITS.opticHeightIn) },
  { key: "rtb", get: (s) => String(s.railToBoreIn), set: (s, v) => withNum(s, v, "railToBoreIn", LIMITS.railToBoreIn) },
  { key: "zero", get: (s) => fmtYd(s.zeroYd), set: (s, v) => withNum(s, v, "zeroYd", LIMITS.zeroYd) },
  { key: "at", get: (s) => fmtYd(s.targetYd), set: (s, v) => withNum(s, v, "targetYd", LIMITS.targetYd) },
  { key: "paper", get: (s) => s.paperId, set: (s, v) => (PAPER_SIZES.some((p) => p.id === v) ? { ...s, paperId: v } : s) },
  { key: "click", get: (s) => s.clickId, set: (s, v) => (CLICK_PRESETS.some((c) => c.id === v) ? { ...s, clickId: v } : s) },
];

// Yards with enough precision to round-trip metric presets (25 m = 27.340332 yd).
const fmtYd = (v: number) => String(Number(v.toFixed(6)));

function withNum<K extends "barrelIn" | "opticHeightIn" | "railToBoreIn" | "zeroYd" | "targetYd">(
  s: Setup,
  v: string,
  key: K,
  limits: readonly [number, number],
): Setup {
  const n = num(v);
  return n == null ? s : { ...s, [key]: clamp(n, limits) };
}

export function setupToQuery(s: Setup): string {
  const params = new URLSearchParams();
  for (const c of CODECS) {
    const v = c.get(s);
    if (v != null && v !== c.get(DEFAULT_SETUP)) params.set(c.key, v);
  }
  return params.toString();
}

export function setupFromQuery(query: string): Setup {
  const params = new URLSearchParams(query);
  let s = DEFAULT_SETUP;
  for (const c of CODECS) {
    const v = params.get(c.key);
    if (v != null) s = c.set(s, v);
  }
  return s;
}
