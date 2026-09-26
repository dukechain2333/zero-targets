import type { UnitSystem } from "./units";

export interface Preset {
  value: number;
  label: string;
  hint?: string;
}

/** Barrel lengths, inches (the same in both unit systems — barrels are sold by the inch). */
export const BARREL_PRESETS: Preset[] = [
  { value: 7.5, label: "7.5" },
  { value: 10.3, label: "10.3" },
  { value: 10.5, label: "10.5" },
  { value: 11.5, label: "11.5" },
  { value: 12.5, label: "12.5" },
  { value: 14.5, label: "14.5" },
  { value: 16, label: "16" },
  { value: 18, label: "18" },
  { value: 20, label: "20" },
];

/** Optic centerline above the top of the rail, inches. */
export const OPTIC_HEIGHT_PRESETS: Preset[] = [
  { value: 1.41, label: "1.41", hint: "Absolute co-witness (Holosun 510C, Scalarworks LEAP 1.42)" },
  { value: 1.5, label: "1.50", hint: "Trijicon MRO full co-witness QR mount" },
  { value: 1.535, label: "1.535", hint: "Lower 1/3 co-witness, Aimpoint 39 mm spacer" },
  { value: 1.54, label: "1.54", hint: "Standard LPVO mounts (Geissele Super Precision, Reptilia AUS, Badger C1)" },
  { value: 1.57, label: "1.57", hint: "Lower 1/3 co-witness (Scalarworks LEAP/01 1.57)" },
  { value: 1.7, label: "1.70", hint: "Mid-height LPVO mounts (Reptilia AUS 34 mm, Badger C.O.M.M.)" },
  { value: 1.93, label: "1.93", hint: "Heads-up height (Scalarworks LEAP 1.93, Geissele 1.93)" },
  { value: 2.05, label: "2.05", hint: "Unity FAST LPVO mount" },
  { value: 2.26, label: "2.26", hint: "Unity FAST Micro, Scalarworks LEAP/02" },
];

/** Bore centerline below the top of the rail, inches, by upper receiver type. */
export const RAIL_TO_BORE_PRESETS: Preset[] = [
  { value: 1.21, label: "1.21", hint: "AR-15 / AR-9 flat-top upper" },
  { value: 1.3, label: "1.30", hint: "AR-10 / SR-25 upper (varies 1.25 to 1.35 by receiver profile)" },
];

/** Distances are stored in yards; metric presets are exact metres converted to yards. */
const yd = (v: number) => v;
const m = (v: number) => v / 0.9144;

export const ZERO_PRESETS: Record<UnitSystem, Preset[]> = {
  imperial: [
    { value: yd(25), label: "25" },
    { value: yd(36), label: "36" },
    { value: yd(50), label: "50" },
    { value: yd(100), label: "100" },
    { value: yd(200), label: "200" },
    { value: yd(300), label: "300" },
  ],
  metric: [
    { value: m(25), label: "25" },
    { value: m(50), label: "50" },
    { value: m(100), label: "100" },
    { value: m(150), label: "150" },
    { value: m(200), label: "200" },
    { value: m(300), label: "300" },
  ],
};

export const TARGET_DISTANCE_PRESETS: Record<UnitSystem, Preset[]> = {
  imperial: [
    { value: yd(7), label: "7" },
    { value: yd(10), label: "10" },
    { value: yd(15), label: "15" },
    { value: yd(25), label: "25" },
    { value: yd(50), label: "50" },
    { value: yd(100), label: "100" },
  ],
  metric: [
    { value: m(10), label: "10" },
    { value: m(15), label: "15" },
    { value: m(20), label: "20" },
    { value: m(25), label: "25" },
    { value: m(50), label: "50" },
    { value: m(100), label: "100" },
  ],
};

/** Longest range in the ballistic card and table. */
export const TABLE_RANGE_PRESETS: Record<UnitSystem, Preset[]> = {
  imperial: [100, 200, 300, 400, 500, 600, 800, 1000].map((v) => ({ value: yd(v), label: String(v) })),
  metric: [100, 200, 300, 400, 500, 600, 800, 1000].map((v) => ({ value: m(v), label: String(v) })),
};

/** Row spacing of the detailed ballistic table. */
export const TABLE_STEP_PRESETS: Record<UnitSystem, Preset[]> = {
  imperial: [10, 25, 50, 100].map((v) => ({ value: yd(v), label: String(v) })),
  metric: [10, 25, 50, 100].map((v) => ({ value: m(v), label: String(v) })),
};

export type AngularUnit = "moa" | "mil";

export interface ClickPreset {
  id: string;
  label: string;
  unit: AngularUnit;
  /** Size of one click in `unit`. */
  size: number;
}

export const CLICK_PRESETS: ClickPreset[] = [
  { id: "0.25moa", label: "1/4 MOA", unit: "moa", size: 0.25 },
  { id: "0.5moa", label: "1/2 MOA", unit: "moa", size: 0.5 },
  { id: "1moa", label: "1 MOA", unit: "moa", size: 1 },
  { id: "0.1mil", label: "0.1 MIL", unit: "mil", size: 0.1 },
  { id: "0.05mil", label: "0.05 MIL", unit: "mil", size: 0.05 },
];

export interface PaperSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

export const PAPER_SIZES: PaperSize[] = [
  { id: "letter", label: "US Letter", widthIn: 8.5, heightIn: 11 },
  { id: "a4", label: "A4", widthIn: 210 / 25.4, heightIn: 297 / 25.4 },
  { id: "legal", label: "US Legal", widthIn: 8.5, heightIn: 14 },
  { id: "tabloid", label: "Tabloid (11×17)", widthIn: 11, heightIn: 17 },
  { id: "a3", label: "A3", widthIn: 297 / 25.4, heightIn: 420 / 25.4 },
];

/** Round-trip a distance to the other unit system: 25 yd <-> 25 m when both are presets. */
export function snapDistance(valueYd: number, from: UnitSystem, to: UnitSystem, presets: Record<UnitSystem, Preset[]>) {
  const match = presets[from].find((p) => Math.abs(p.value - valueYd) < 1e-6);
  if (!match) return valueYd;
  const twin = presets[to].find((p) => p.label === match.label);
  return twin ? twin.value : valueYd;
}
