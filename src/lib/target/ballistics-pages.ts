// Printable ballistic data: a sheet of wallet-size quick cards and a detailed multi-page table.
// Same primitive format as the target page (inches, top-left origin, sizes in points).

import { TABLE_WIND_MPH, type BallisticTable, type TableRow } from "../ballistic-table";
import type { ZeroResult } from "../compute";
import type { Setup } from "../setup";
import {
  distanceToDisplay,
  distanceUnit,
  energyUnit,
  fmtBarrel,
  fmtSightHeight,
  fmtVelocity,
  fmtWind,
  trimNumber,
  velocityToDisplay,
  velocityUnit,
  type UnitSystem,
} from "../units";
import { COLORS, distanceLabel, unitLabel, type PageScene, type Prim } from "./scene";
import { textWidthIn } from "./text-metrics";

const ZEBRA = "#eef0f3";
const RULE = "#9aa3ad";
const CUT = "#8a8a8a";

// ---------------------------------------------------------------- value formatting

const signed = (v: number, decimals: number) => {
  const s = Math.abs(v).toFixed(decimals);
  if (Number(s) === 0) return (0).toFixed(decimals);
  return `${v > 0 ? "+" : "-"}${s}`;
};

/** Path/drift length: inches or centimetres. */
const lengthValue = (inch: number, u: UnitSystem) => (u === "metric" ? inch * 2.54 : inch);
const lengthUnit = (u: UnitSystem) => (u === "metric" ? "cm" : "in");
const lengthDecimals = (v: number) => (Math.abs(v) >= 100 ? 0 : 1);

export const fmtAngle = (v: number, unit: "moa" | "mil", withSign = true) => {
  const d = unit === "mil" ? 2 : 1;
  return withSign ? signed(v, d) : Math.abs(v).toFixed(d);
};

export const fmtClicks = (clicks: number) => (clicks === 0 ? "0" : `${clicks > 0 ? "U" : "D"} ${Math.abs(clicks)}`);

export const fmtLength = (inch: number, u: UnitSystem, withSign = true) => {
  const v = lengthValue(inch, u);
  return withSign ? signed(v, lengthDecimals(v)) : Math.abs(v).toFixed(lengthDecimals(v));
};

const fmtRange = (yd: number, u: UnitSystem) => String(Math.round(distanceToDisplay(yd, u)));

/** Shorten `text` with an ellipsis until it fits `maxIn` at the given size. */
function fit(text: string, sizePt: number, maxIn: number, bold = false) {
  if (textWidthIn(text, sizePt, bold) <= maxIn) return text;
  let t = text;
  while (t.length > 1 && textWidthIn(`${t}...`, sizePt, bold) > maxIn) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

// ---------------------------------------------------------------- quick cards

const CARD_W = 3.5;
const CARD_H = 2;

function drawCard(prims: Prim[], x0: number, y0: number, setup: Setup, result: ZeroResult, table: BallisticTable) {
  const { resolved } = result;
  const u = setup.units;
  const unit = unitLabel(table.unit);
  const pad = 0.14;
  const text = (p: Omit<Extract<Prim, { t: "text" }>, "t">) => prims.push({ t: "text", ...p });
  const zero = `${distanceLabel(setup.zeroYd, u).toUpperCase()} ZERO`;

  text({ x: x0 + CARD_W - pad, y: y0 + 0.21, text: zero, size: 7.5, bold: true, color: COLORS.ink, align: "right" });
  const titleRoom = CARD_W - 2 * pad - textWidthIn(zero, 7.5, true) - 0.1;
  text({ x: x0 + pad, y: y0 + 0.21, text: fit(resolved.loadShort, 7.5, titleRoom, true), size: 7.5, bold: true, color: COLORS.ink });
  const conditions = `${resolved.click.label} clicks`;
  text({ x: x0 + CARD_W - pad, y: y0 + 0.34, text: conditions, size: 5.5, color: COLORS.muted, align: "right" });
  text({
    x: x0 + pad,
    y: y0 + 0.34,
    text: fit(
      `${fmtVelocity(resolved.muzzleVelocityFps, u)} | ${fmtBarrel(setup.barrelIn)} bbl | ${fmtSightHeight(resolved.sightHeightIn, u)} sight`,
      5.5,
      CARD_W - 2 * pad - textWidthIn(conditions, 5.5) - 0.1,
    ),
    size: 5.5,
    color: COLORS.muted,
  });
  prims.push({ t: "line", x1: x0 + pad, y1: y0 + 0.4, x2: x0 + CARD_W - pad, y2: y0 + 0.4, w: 0.5, color: RULE });

  // Columns: right edges, measured from the card's left side.
  const cols: [edge: number, label: string, sub: string][] = [
    [0.6, "RANGE", distanceUnit(u)],
    [1.26, "HOLD", lengthUnit(u)],
    [1.94, "ELEV", unit],
    [2.6, "CLICKS", resolved.click.label],
    [CARD_W - pad, "WIND", unit],
  ];
  for (const [edge, label, sub] of cols) {
    text({ x: x0 + edge, y: y0 + 0.51, text: label, size: 5.5, bold: true, color: COLORS.ink, align: "right" });
    text({ x: x0 + edge, y: y0 + 0.59, text: sub, size: 5, color: COLORS.muted, align: "right" });
  }
  prims.push({ t: "line", x1: x0 + pad, y1: y0 + 0.63, x2: x0 + CARD_W - pad, y2: y0 + 0.63, w: 0.5, color: RULE });

  const rows = table.cardRows;
  const top = y0 + 0.63;
  const rowH = Math.min(0.12, (CARD_H - 0.63 - 0.17) / Math.max(rows.length, 1));
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    if (i % 2 === 1) prims.push({ t: "rect", x: x0 + pad - 0.02, y, w: CARD_W - 2 * pad + 0.04, h: rowH, fill: ZEBRA });
    const base = y + rowH * 0.74;
    const isZero = Math.abs(r.rangeYd - setup.zeroYd) < 0.01;
    const values = [
      fmtRange(r.rangeYd, u),
      fmtLength(-r.pathIn, u),
      fmtAngle(r.elevation, table.unit),
      fmtClicks(r.elevationClicks),
      fmtAngle(r.wind, table.unit, false),
    ];
    values.forEach((v, c) =>
      text({ x: x0 + cols[c][0], y: base, text: v, size: 7, bold: isZero || c === 0, color: COLORS.ink, align: "right" }),
    );
  });

  text({
    x: x0 + pad,
    y: y0 + CARD_H - 0.08,
    text: `+ = hold / dial UP.  Wind: ${fmtWind(TABLE_WIND_MPH, u)} full value, hold into it.`,
    size: 5,
    color: COLORS.muted,
  });
}

function cardsPage(setup: Setup, result: ZeroResult, table: BallisticTable): PageScene {
  const { widthIn: W, heightIn: H } = result.resolved.paper;
  const prims: Prim[] = [];
  const M = 0.5;
  prims.push({ t: "text", x: M, y: M + 0.24, text: "BALLISTIC CARDS", size: 18, bold: true, color: COLORS.ink });
  prims.push({
    t: "text",
    x: M,
    y: M + 0.48,
    text: "Cut along the dashed lines. Laminate or tape one inside a scope cap, on the stock or in your wallet.",
    size: 9,
    color: COLORS.ink,
  });

  const cols = Math.max(1, Math.floor((W - 2 * M) / CARD_W));
  const rows = Math.max(1, Math.floor((H - (M + 0.8) - M) / CARD_H));
  const bx = (W - cols * CARD_W) / 2;
  const by = M + 0.8;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawCard(prims, bx + c * CARD_W, by + r * CARD_H, setup, result, table);

  // Shared cut lines, overshooting the block a little so the cuts are easy to line up.
  const over = 0.2;
  for (let c = 0; c <= cols; c++) {
    const x = bx + c * CARD_W;
    prims.push({ t: "line", x1: x, y1: by - over, x2: x, y2: by + rows * CARD_H + over, w: 0.5, color: CUT, dash: 0.06 });
  }
  for (let r = 0; r <= rows; r++) {
    const y = by + r * CARD_H;
    prims.push({ t: "line", x1: bx - over, y1: y, x2: bx + cols * CARD_W + over, y2: y, w: 0.5, color: CUT, dash: 0.06 });
  }
  return { widthIn: W, heightIn: H, prims };
}

// ---------------------------------------------------------------- detailed table

export interface Column {
  label: string;
  sub: string;
  width: number;
  value: (r: TableRow) => string;
}

/** Detailed-table columns, shared by the PDF and the web table. */
export function tableColumns(setup: Setup, result: ZeroResult, table: BallisticTable): Column[] {
  const u = setup.units;
  const unit = unitLabel(table.unit);
  return [
    { label: "Range", sub: distanceUnit(u), width: 0.7, value: (r) => fmtRange(r.rangeYd, u) },
    { label: "Path", sub: lengthUnit(u), width: 0.8, value: (r) => fmtLength(r.pathIn, u) },
    { label: "Elevation", sub: unit, width: 0.9, value: (r) => fmtAngle(r.elevation, table.unit) },
    { label: "Clicks", sub: result.resolved.click.label, width: 0.85, value: (r) => fmtClicks(r.elevationClicks) },
    { label: "Wind drift", sub: lengthUnit(u), width: 0.85, value: (r) => fmtLength(r.windIn, u, false) },
    { label: "Wind", sub: unit, width: 0.75, value: (r) => fmtAngle(r.wind, table.unit, false) },
    { label: "Velocity", sub: velocityUnit(u), width: 0.8, value: (r) => Math.round(velocityToDisplay(r.velocityFps, u)).toLocaleString("en-US") },
    { label: "Energy", sub: energyUnit(u), width: 0.8, value: (r) => Math.round(r.energy).toLocaleString("en-US") },
    { label: "Time", sub: "s", width: 0.65, value: (r) => r.timeS.toFixed(3) },
  ];
}

function tablePages(setup: Setup, result: ZeroResult, table: BallisticTable): PageScene[] {
  const { resolved } = result;
  const { widthIn: W, heightIn: H } = resolved.paper;
  const u = setup.units;
  const M = 0.5;
  const rowH = 0.19;
  const columns = tableColumns(setup, result, table);
  const total = columns.reduce((s, c) => s + c.width, 0);
  const scale = (W - 2 * M) / total;
  const edges: number[] = [];
  columns.reduce((x, c) => {
    edges.push(x + c.width * scale - 0.08);
    return x + c.width * scale;
  }, M);

  const firstTop = M + 1.45;
  const nextTop = M + 0.55;
  const footer = 0.55;
  const perFirst = Math.floor((H - footer - firstTop - 0.3) / rowH);
  const perNext = Math.floor((H - footer - nextTop - 0.3) / rowH);
  const chunks: TableRow[][] = [table.rows.slice(0, perFirst)];
  for (let i = perFirst; i < table.rows.length; i += perNext) chunks.push(table.rows.slice(i, i + perNext));

  const zero = `${distanceLabel(setup.zeroYd, u).toUpperCase()} ZERO`;
  const mvNote = resolved.mvSource === "measured" ? "measured" : "estimated";
  const subsonic =
    table.subsonicYd != null ? `  Goes subsonic near ${fmtRange(table.subsonicYd, u)} ${distanceUnit(u)} (gray rows).` : "";

  return chunks.map((rows, pageIndex) => {
    const prims: Prim[] = [];
    const text = (p: Omit<Extract<Prim, { t: "text" }>, "t">) => prims.push({ t: "text", ...p });
    let top: number;
    if (pageIndex === 0) {
      text({ x: M, y: M + 0.24, text: "BALLISTIC TABLE", size: 18, bold: true, color: COLORS.ink });
      const badgeW = textWidthIn(zero, 13, true) + 0.3;
      prims.push({ t: "rect", x: W - M - badgeW, y: M, w: badgeW, h: 0.36, fill: COLORS.ink, radius: 0.05 });
      text({ x: W - M - badgeW / 2, y: M + 0.245, text: zero, size: 13, bold: true, color: COLORS.white, align: "center" });
      const lines = [
        `${resolved.loadName}  |  ${resolved.weightGr} gr, ${resolved.dragModel} BC ${resolved.bc}  |  ${fmtVelocity(resolved.muzzleVelocityFps, u)} (${mvNote})`,
        `${fmtBarrel(setup.barrelIn)} barrel  |  sight height ${fmtSightHeight(resolved.sightHeightIn, u)} (${fmtSightHeight(setup.opticHeightIn, u)} optic + ${fmtSightHeight(setup.railToBoreIn, u)} rail to bore)`,
        `Standard air (sea level, ${u === "metric" ? "15 °C" : "59 °F"})  |  wind ${fmtWind(TABLE_WIND_MPH, u)} full value from 9 o'clock  |  turret ${resolved.click.label} per click`,
      ];
      lines.forEach((l, i) => text({ x: M, y: M + 0.58 + i * 0.17, text: fit(l, 8.5, W - 2 * M), size: 8.5, color: COLORS.ink }));
      top = firstTop;
    } else {
      text({ x: M, y: M + 0.2, text: `BALLISTIC TABLE (continued)  |  ${resolved.loadShort}  |  ${zero}`, size: 10, bold: true, color: COLORS.ink });
      top = nextTop;
    }

    // Column headers.
    columns.forEach((c, i) => {
      text({ x: edges[i], y: top - 0.16, text: c.label, size: 7.5, bold: true, color: COLORS.ink, align: "right" });
      text({ x: edges[i], y: top - 0.04, text: c.sub, size: 7, color: COLORS.muted, align: "right" });
    });
    prims.push({ t: "line", x1: M, y1: top + 0.02, x2: W - M, y2: top + 0.02, w: 0.8, color: COLORS.ink });

    rows.forEach((r, i) => {
      const y = top + 0.04 + i * rowH;
      if (i % 2 === 1) prims.push({ t: "rect", x: M, y, w: W - 2 * M, h: rowH, fill: ZEBRA });
      const isZero = Math.abs(r.rangeYd - setup.zeroYd) < 0.01;
      columns.forEach((c, ci) =>
        text({
          x: edges[ci],
          y: y + rowH * 0.72,
          text: c.value(r),
          size: 8.5,
          bold: isZero || ci === 0,
          color: r.subsonic ? COLORS.muted : COLORS.ink,
          align: "right",
        }),
      );
    });
    const bottom = top + 0.04 + rows.length * rowH;
    prims.push({ t: "line", x1: M, y1: bottom, x2: W - M, y2: bottom, w: 0.8, color: COLORS.ink });

    text({
      x: M,
      y: H - M,
      text: `Path: + above the line of sight.  Elevation and clicks: + / U = dial or hold UP.  Wind: correct into the wind.${subsonic}`,
      size: 7,
      color: COLORS.muted,
    });
    text({ x: W - M, y: H - M + 0.16, text: `zero-targets  |  page ${pageIndex + 1} of ${chunks.length}`, size: 7, color: COLORS.muted, align: "right" });
    return { widthIn: W, heightIn: H, prims };
  });
}

// ---------------------------------------------------------------- document

export interface BallisticsDoc {
  pages: { label: string; scene: PageScene }[];
  title: string;
  fileName: string;
}

export function buildBallisticsDoc(
  setup: Setup,
  result: ZeroResult,
  table: BallisticTable,
  include: { cards: boolean; table: boolean },
): BallisticsDoc {
  const pages: BallisticsDoc["pages"] = [];
  if (include.cards) pages.push({ label: "Cards", scene: cardsPage(setup, result, table) });
  if (include.table) {
    const t = tablePages(setup, result, table);
    t.forEach((scene, i) => pages.push({ label: t.length > 1 ? `Table ${i + 1}` : "Table", scene }));
  }
  const slug = result.resolved.loadShort.replace(/[^A-Za-z0-9.]+/g, "-").replace(/^-|-$/g, "");
  const zero = `${trimNumber(distanceToDisplay(setup.zeroYd, setup.units), 1)}${distanceUnit(setup.units)}`;
  return {
    pages,
    title: `Ballistic card and table: ${result.resolved.loadShort}, ${zero} zero`,
    fileName: `ballistics_${slug}_${trimNumber(setup.barrelIn, 2)}in_${zero}-zero.pdf`,
  };
}
