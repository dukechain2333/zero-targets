// Internal canonical units: distance in yards, lengths in inches, velocity in fps.

export type UnitSystem = "imperial" | "metric";

export const M_PER_YD = 0.9144;
export const MM_PER_IN = 25.4;
export const MPS_PER_FPS = 0.3048;

/** Size of one MOA (inches) at a distance in yards. */
export const moaInches = (distanceYd: number) => Math.tan(Math.PI / 10800) * distanceYd * 36;
/** Size of one milliradian (inches) at a distance in yards. */
export const milInches = (distanceYd: number) => 0.001 * distanceYd * 36;

export const ydToM = (yd: number) => yd * M_PER_YD;
export const mToYd = (m: number) => m / M_PER_YD;

/** Trim float noise: 25.000000001 -> "25", 1.5400001 -> "1.54". */
export function trimNumber(v: number, maxDecimals = 2): string {
  return String(Number(v.toFixed(maxDecimals)));
}

const grouped = (v: number, decimals = 0) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ---------------------------------------------------------------- per-system display

export const distanceUnit = (s: UnitSystem) => (s === "metric" ? "m" : "yd");
export const heightUnit = (s: UnitSystem) => (s === "metric" ? "mm" : "in");
export const velocityUnit = (s: UnitSystem) => (s === "metric" ? "m/s" : "fps");

export const distanceToDisplay = (yd: number, s: UnitSystem) => (s === "metric" ? ydToM(yd) : yd);
export const distanceFromDisplay = (v: number, s: UnitSystem) => (s === "metric" ? mToYd(v) : v);
export const heightToDisplay = (inch: number, s: UnitSystem) => (s === "metric" ? inch * MM_PER_IN : inch);
export const heightFromDisplay = (v: number, s: UnitSystem) => (s === "metric" ? v / MM_PER_IN : v);
export const velocityToDisplay = (fps: number, s: UnitSystem) => (s === "metric" ? fps * MPS_PER_FPS : fps);
export const velocityFromDisplay = (v: number, s: UnitSystem) => (s === "metric" ? v / MPS_PER_FPS : v);

export function fmtDistance(yd: number, s: UnitSystem): string {
  return `${trimNumber(distanceToDisplay(yd, s), 1)} ${distanceUnit(s)}`;
}

/** Offsets on paper: inches to 2 decimals, or whole-ish millimetres. */
export function fmtOffset(inch: number, s: UnitSystem): string {
  return s === "metric" ? `${(inch * MM_PER_IN).toFixed(1)} mm` : `${inch.toFixed(2)} in`;
}

/** Heights along the trajectory (can be many inches). */
export function fmtPath(inch: number, s: UnitSystem): string {
  if (s === "metric") {
    const cm = inch * 2.54;
    return `${cm.toFixed(Math.abs(cm) < 10 ? 1 : 0)} cm`;
  }
  return `${inch.toFixed(Math.abs(inch) < 10 ? 2 : 1)} in`;
}

/** Optic and sight heights: mount heights like 1.535 in need the third decimal. */
export function fmtSightHeight(inch: number, s: UnitSystem): string {
  return s === "metric" ? `${trimNumber(inch * MM_PER_IN, 1)} mm` : `${trimNumber(inch, 3)} in`;
}

export function fmtVelocity(fps: number, s: UnitSystem): string {
  return `${grouped(velocityToDisplay(fps, s))} ${velocityUnit(s)}`;
}

export function fmtBarrel(inch: number): string {
  return `${trimNumber(inch, 2)} in`;
}

// ---------------------------------------------------------------- wind and energy

export const MPH_PER_MPS = 3600 / 1609.344;

export const windUnit = (s: UnitSystem) => (s === "metric" ? "m/s" : "mph");
export const energyUnit = (s: UnitSystem) => (s === "metric" ? "J" : "ft-lb");

export const windToDisplay = (mph: number, s: UnitSystem) => (s === "metric" ? mph / MPH_PER_MPS : mph);

/** Kinetic energy in ft-lb (imperial) or joules (metric). */
export function energy(weightGr: number, fps: number, s: UnitSystem): number {
  const ftLb = (weightGr * fps * fps) / 450240;
  return s === "metric" ? ftLb * 1.3558179 : ftLb;
}

export function fmtWind(mph: number, s: UnitSystem): string {
  return `${trimNumber(windToDisplay(mph, s), 1)} ${windUnit(s)}`;
}
