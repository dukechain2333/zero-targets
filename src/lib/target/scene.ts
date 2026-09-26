// Printable target page as a flat list of drawing primitives. Units are inches with the origin at
// the top-left corner of the page (y grows downward); line widths and font sizes are in points.
// The SVG preview and the PDF export both draw from this list, so they always match.

import type { ZeroResult } from "../compute";
import type { AngularUnit, ClickPreset } from "../presets";
import type { Setup } from "../setup";
import {
  distanceToDisplay,
  distanceUnit,
  fmtBarrel,
  fmtOffset,
  fmtSightHeight,
  fmtVelocity,
  milInches,
  moaInches,
  MM_PER_IN,
  trimNumber,
  type UnitSystem,
} from "../units";
import { textWidthIn } from "./text-metrics";

export type Prim =
  | {
      t: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      w: number;
      color: string;
      cap?: "butt" | "square";
      /** Dash and gap length, inches. */
      dash?: number;
    }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; w?: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; radius?: number }
  | { t: "tri"; pts: [[number, number], [number, number], [number, number]]; fill: string }
  | {
      t: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      bold?: boolean;
      color: string;
      align?: "left" | "center" | "right";
      /** Paint a background-colored knockout behind the text. */
      halo?: string;
    };

export interface GridSpec {
  unit: AngularUnit;
  /** Angular size of one square. */
  step: number;
  /** Major line every `majorEvery` squares. */
  majorEvery: number;
  /** Physical size of one square on paper, inches. */
  stepIn: number;
}

/** One printed page. */
export interface PageScene {
  widthIn: number;
  heightIn: number;
  prims: Prim[];
}

export interface TargetScene extends PageScene {
  /** False when AIM and IMPACT cannot both fit on this paper. */
  fits: boolean;
  grid: GridSpec;
  title: string;
  fileName: string;
}

export const COLORS = {
  ink: "#000000",
  white: "#ffffff",
  red: "#d90d0d",
  gridMinor: "#bdcce0",
  gridMajor: "#6b82a3",
  axis: "#4d4d4d",
  muted: "#666666",
};

const MIN_SQUARE_IN = 0.18;
const GRID_STEPS: Record<AngularUnit, [step: number, majorEvery: number][]> = {
  moa: [[0.25, 4], [0.5, 2], [1, 5], [2, 5], [5, 2], [10, 5]],
  mil: [[0.05, 2], [0.1, 5], [0.2, 5], [0.5, 2], [1, 5], [2, 5]],
};

export const angularInches = (unit: AngularUnit, distanceYd: number) =>
  unit === "moa" ? moaInches(distanceYd) : milInches(distanceYd);

/** Finest grid whose squares are still large enough to count on paper. */
export function gridSpec(unit: AngularUnit, targetYd: number): GridSpec {
  const perUnit = angularInches(unit, targetYd);
  const steps = GRID_STEPS[unit];
  const [step, majorEvery] = steps.find(([s]) => s * perUnit >= MIN_SQUARE_IN) ?? steps[steps.length - 1];
  return { unit, step, majorEvery, stepIn: step * perUnit };
}

/** "2 clicks per square" / "1 click = 4 squares". */
export function clicksPerSquareText(grid: GridSpec, click: ClickPreset): string {
  const cps = grid.step / click.size;
  if (cps >= 1) return `${trimNumber(cps, 2)} click${cps === 1 ? "" : "s"} per square`;
  return `1 click = ${trimNumber(1 / cps, 2)} squares`;
}

export const unitLabel = (u: AngularUnit) => (u === "moa" ? "MOA" : "MIL");

export function distanceLabel(yd: number, units: UnitSystem): string {
  return `${trimNumber(distanceToDisplay(yd, units), 1)} ${distanceUnit(units)}`;
}

function squareSizeText(inch: number, units: UnitSystem) {
  return units === "metric" ? `${(inch * MM_PER_IN).toFixed(1)} mm` : `${inch.toFixed(2)} in`;
}

export function buildTargetScene(setup: Setup, result: ZeroResult): TargetScene {
  const { resolved } = result;
  const { units, targetYd, zeroYd } = setup;
  const W = resolved.paper.widthIn;
  const H = resolved.paper.heightIn;
  const prims: Prim[] = [];
  const text = (p: Omit<Extract<Prim, { t: "text" }>, "t">) => prims.push({ t: "text", ...p });
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, color = COLORS.ink) =>
    prims.push({ t: "line", x1, y1, x2, y2, w, color });

  const grid = gridSpec(resolved.click.unit, targetYd);
  const unitName = unitLabel(grid.unit);
  const offset = result.offsetIn; // + = IMPACT above AIM
  const offsetAngle = offset / angularInches(grid.unit, targetYd);
  const targetLabel = distanceLabel(targetYd, units).toUpperCase();
  const zeroLabel = distanceLabel(zeroYd, units).toUpperCase();

  // ------------------------------------------------------------ header
  const M = 0.5;
  text({ x: M, y: M + 0.24, text: `${targetLabel} ZERO TARGET`, size: 22, bold: true, color: COLORS.ink });
  const mvNote = resolved.mvSource === "measured" ? "measured" : "est.";
  text({
    x: M,
    y: M + 0.5,
    text: `${resolved.loadShort}  |  ${fmtVelocity(resolved.muzzleVelocityFps, units)} (${mvNote})`,
    size: 10,
    color: COLORS.ink,
  });
  text({
    x: M,
    y: M + 0.69,
    text:
      `${fmtBarrel(setup.barrelIn)} barrel  |  ${fmtSightHeight(setup.opticHeightIn, units)} optic height  |  ` +
      `${fmtSightHeight(resolved.sightHeightIn, units)} over bore`,
    size: 10,
    color: COLORS.ink,
  });
  const badge = `${zeroLabel} ZERO`;
  const badgeW = textWidthIn(badge, 20, true) + 0.36;
  prims.push({ t: "rect", x: W - M - badgeW, y: M, w: badgeW, h: 0.5, fill: COLORS.ink, radius: 0.06 });
  text({ x: W - M - badgeW / 2, y: M + 0.33, text: badge, size: 20, bold: true, color: COLORS.white, align: "center" });

  // ------------------------------------------------------------ grid, anchored on IMPACT
  const areaTop = M + 0.98;
  const areaBottom = H - 1.3;
  const labelGutter = 0.28;
  const areaW = W - 2 * (M + labelGutter);
  const s = grid.stepIn;
  const cols = 2 * Math.floor(areaW / s / 2);
  const rows = Math.floor((areaBottom - areaTop) / s);
  const cx = W / 2;
  const gx0 = cx - (cols / 2) * s;
  const gx1 = cx + (cols / 2) * s;
  const gy0 = areaTop + ((areaBottom - areaTop) - rows * s) / 2;
  const gy1 = gy0 + rows * s;

  // Place the AIM/IMPACT pair around the grid's middle, snapped so a grid line runs through IMPACT.
  // Page y grows downward and IMPACT sits `offset` above AIM, so AIM y = IMPACT y + offset.
  const ideal = (gy0 + gy1) / 2 - offset / 2;
  const k = Math.round((ideal - gy0) / s);
  const iy = gy0 + k * s;
  const ay = iy + offset;

  for (let i = -cols / 2; i <= cols / 2; i++) {
    const major = i % grid.majorEvery === 0;
    const x = cx + i * s;
    line(x, gy0, x, gy1, major ? 0.9 : 0.4, major ? COLORS.gridMajor : COLORS.gridMinor);
    if (major && i !== -cols / 2 && i !== cols / 2) {
      text({ x, y: gy1 + 0.13, text: trimNumber(Math.abs(i * grid.step), 2), size: 6.5, color: COLORS.gridMajor, align: "center" });
    }
  }
  for (let j = -k; j <= rows - k; j++) {
    const major = j % grid.majorEvery === 0;
    const y = iy + j * s;
    line(gx0, y, gx1, y, major ? 0.9 : 0.4, major ? COLORS.gridMajor : COLORS.gridMinor);
    if (major) {
      text({ x: gx0 - 0.06, y: y + 0.03, text: trimNumber(Math.abs(j * grid.step), 2), size: 6.5, color: COLORS.gridMajor, align: "right" });
    }
  }
  prims.push({ t: "rect", x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0, stroke: COLORS.gridMajor, lw: 1 });
  text({ x: gx0 - 0.06, y: gy0 - 0.06, text: unitName, size: 6.5, bold: true, color: COLORS.gridMajor, align: "right" });
  line(cx, gy0, cx, gy1, 0.9, COLORS.axis);
  line(gx0, iy, gx1, iy, 1, COLORS.red);

  // ------------------------------------------------------------ AIM
  // The aim circle grows with distance (so a red dot still fits inside it) but never reaches IMPACT.
  const bar = 0.075;
  const gap = 0.12;
  const ri = Math.min(0.35, Math.max(0.2, moaInches(targetYd)));
  const dist = Math.abs(offset);
  const r = Math.max(0.25, Math.min(0.75, 1.25 * moaInches(targetYd), dist - ri - gap - 0.08));
  const barW = bar * 72;
  const armH = 1.3;
  // Vertical arm points away from IMPACT so it never covers it.
  const armDir = offset > 0 ? 1 : -1;
  const armRoom = armDir < 0 ? ay - r - gap - gy0 - 0.1 : gy1 - (ay + r + gap) - 0.1;
  const armV = Math.max(0, Math.min(1.1, armRoom));

  prims.push({ t: "circle", cx, cy: ay, r: r + gap, fill: COLORS.white });
  prims.push({ t: "circle", cx, cy: ay, r, stroke: COLORS.ink, w: barW });
  line(cx - r - gap, ay, cx - r - gap - armH, ay, barW);
  line(cx + r + gap, ay, cx + r + gap + armH, ay, barW);
  if (armV > 0.2) line(cx, ay + armDir * (r + gap), cx, ay + armDir * (r + gap + armV), barW);
  line(cx - 0.09, ay, cx + 0.09, ay, 0.9);
  line(cx, ay - 0.09, cx, ay + 0.09, 0.9);
  text({ x: cx + r + 0.22, y: ay - 0.13, text: "AIM", size: 13, bold: true, color: COLORS.ink, halo: COLORS.white });

  // ------------------------------------------------------------ IMPACT
  const tick = ri * 0.65;
  prims.push({ t: "circle", cx, cy: iy, r: ri, stroke: COLORS.red, w: 1.6 });
  line(cx - tick, iy, cx + tick, iy, 1.6, COLORS.red);
  line(cx, iy - tick, cx, iy + tick, 1.6, COLORS.red);
  prims.push({ t: "circle", cx, cy: iy, r: 0.028, fill: COLORS.red });
  text({ x: cx + ri + 0.14, y: iy + 0.065, text: "IMPACT", size: 13, bold: true, color: COLORS.red, halo: COLORS.white });

  // ------------------------------------------------------------ AIM -> IMPACT dimension
  const dimX = cx - r - gap - 0.55;
  if (dist >= 0.2) {
    line(dimX, Math.min(ay, iy) + 0.02, dimX, Math.max(ay, iy) - 0.02, 1);
    const head = (y: number, dir: 1 | -1) =>
      prims.push({ t: "tri", pts: [[dimX, y], [dimX - 0.032, y + dir * 0.07], [dimX + 0.032, y + dir * 0.07]], fill: COLORS.ink });
    head(Math.min(ay, iy), 1);
    head(Math.max(ay, iy), -1);
  }
  const my = (ay + iy) / 2;
  text({ x: dimX - 0.1, y: my - 0.01, text: fmtOffset(dist, units), size: 13, bold: true, color: COLORS.ink, align: "right", halo: COLORS.white });
  text({
    x: dimX - 0.1,
    y: my + 0.17,
    text: `${Math.abs(offsetAngle).toFixed(1)} ${unitName}`,
    size: 9,
    color: COLORS.ink,
    align: "right",
    halo: COLORS.white,
  });

  const topMost = Math.min(ay - r - gap - (armDir < 0 ? armV : 0), iy - ri);
  const bottomMost = Math.max(ay + r + gap + (armDir > 0 ? armV : 0), iy + ri);
  const fits = topMost >= gy0 && bottomMost <= gy1;

  // ------------------------------------------------------------ footer
  const where = dist < 0.005 ? "on" : offset < 0 ? "below" : "above";
  const relation =
    where === "on"
      ? `At ${targetLabel.toLowerCase()} IMPACT and AIM coincide.`
      : `IMPACT is ${fmtOffset(dist, units)} (${Math.abs(offsetAngle).toFixed(1)} ${unitName}) ${where} AIM.`;
  text({
    x: M,
    y: H - 1.0,
    text: "Aim at the center of AIM. Adjust the optic until the group centers on IMPACT.",
    size: 11.5,
    bold: true,
    color: COLORS.ink,
  });
  text({
    x: M,
    y: H - 0.79,
    text:
      `${relation}  1 square = ${trimNumber(grid.step, 2)} ${unitName} = ${squareSizeText(s, units)} at ${targetLabel.toLowerCase()}.  ` +
      `${resolved.click.label} clicks: ${clicksPerSquareText(grid, resolved.click)}.`,
    size: 9.5,
    color: COLORS.ink,
  });

  // Scale check bar: 2 in or 50 mm, so a mis-scaled print is caught before shooting.
  const scaleIn = units === "metric" ? 50 / MM_PER_IN : 2;
  const scaleLabel = units === "metric" ? "50 mm" : "2.00 in";
  const sy = H - 0.55;
  prims.push({ t: "rect", x: M, y: sy - 0.07, w: scaleIn, h: 0.07, fill: COLORS.ink });
  line(M, sy - 0.14, M, sy, 0.8);
  line(M + scaleIn, sy - 0.14, M + scaleIn, sy, 0.8);
  text({
    x: M + scaleIn + 0.12,
    y: sy - 0.005,
    text: `Print at 100% / Actual size. This bar must measure exactly ${scaleLabel}.`,
    size: 8.5,
    color: COLORS.ink,
  });
  text({
    x: W - M,
    y: H - 0.3,
    text: `zero-targets  |  ${resolved.dragModel} BC ${resolved.bc}  |  std. atmosphere`,
    size: 7,
    color: COLORS.muted,
    align: "right",
  });

  const title = `${targetLabel} target for ${zeroLabel} zero`;
  const fileName =
    `zero-target_${trimNumber(distanceToDisplay(targetYd, units), 1)}${distanceUnit(units)}-for-` +
    `${trimNumber(distanceToDisplay(zeroYd, units), 1)}${distanceUnit(units)}-zero_` +
    `${trimNumber(setup.barrelIn, 2)}in_${trimNumber(setup.opticHeightIn, 3)}in-optic.pdf`;

  return { widthIn: W, heightIn: H, prims, fits, grid, title, fileName };
}
