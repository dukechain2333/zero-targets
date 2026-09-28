"use client";

import { useEffect, useRef, useState } from "react";
import type { ZeroResult } from "@/lib/compute";
import { distanceFromDisplay, distanceToDisplay, distanceUnit, fmtPath, trimNumber, type UnitSystem } from "@/lib/units";

interface Props {
  result: ZeroResult;
  units: UnitSystem;
  targetYd: number;
  zeroYd: number;
  height?: number;
  /** Small inline version: no axis titles, fewer ticks. */
  compact?: boolean;
}

// Labels sit on top of the path; a surface-colored stroke keeps them readable.
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
const FULL_PAD = { top: 20, right: 20, bottom: 40, left: 52 };
const COMPACT_PAD = { top: 16, right: 8, bottom: 22, left: 30 };

function niceStep(span: number, maxTicks: number) {
  const raw = span / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

function ticks(lo: number, hi: number, maxTicks: number) {
  const step = niceStep(hi - lo, maxTicks);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** Bullet height at any range, interpolated between the per-yard samples. */
function heightAt(pts: ZeroResult["trajectory"], yd: number) {
  const i = pts.findIndex((p) => p.rangeYd >= yd);
  if (i <= 0) return pts[Math.max(0, i)].heightIn;
  const a = pts[i - 1];
  const b = pts[i];
  return a.heightIn + ((yd - a.rangeYd) / (b.rangeYd - a.rangeYd)) * (b.heightIn - a.heightIn);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Bullet path relative to the line of sight, with the target distance and zero crossings marked. */
export function TrajectoryChart({ result, units, targetYd, zeroYd, height: HEIGHT = 300, compact = false }: Props) {
  const PAD = compact ? COMPACT_PAD : FULL_PAD;
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  // Hovered distance in whole display units (yd or m), so the readout steps 1 yd / 1 m at a time.
  const [hover, setHover] = useState<number | null>(null);
  const pts = result.trajectory;
  const metric = units === "metric";
  // Display units: distance yd/m, height in/cm.
  const hx = (yd: number) => distanceToDisplay(yd, units);
  const hy = (inch: number) => (metric ? inch * 2.54 : inch);
  const yUnit = metric ? "cm" : "in";

  const xMax = hx(result.chartMaxYd);
  const ys = pts.map((p) => hy(p.heightIn));
  const yLo = Math.min(0, ...ys);
  const yHi = Math.max(0, ...ys);
  const yPad = (yHi - yLo) * 0.08 || 1;
  const yTicks = ticks(yLo - yPad, yHi + yPad, compact ? 4 : 6);
  const y0 = Math.min(yTicks[0], yLo - yPad);
  const y1 = Math.max(yTicks[yTicks.length - 1], yHi + yPad);
  const xTicks = ticks(0, xMax, Math.max(3, Math.floor(width / (compact ? 70 : 90))));

  const iw = width - PAD.left - PAD.right;
  const ih = HEIGHT - PAD.top - PAD.bottom;
  const sx = (v: number) => PAD.left + (v / xMax) * iw;
  const sy = (v: number) => PAD.top + ((y1 - v) / (y1 - y0)) * ih;

  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(hx(p.rangeYd)).toFixed(1)},${sy(hy(p.heightIn)).toFixed(1)}`).join("");
  const targetPoint = { x: hx(targetYd), y: hy(result.offsetIn) };
  const crossings = result.crossingsYd;
  const lastWhole = Math.floor(xMax);
  const clampWhole = (v: number) => Math.min(lastWhole, Math.max(0, Math.round(v)));
  const hovered =
    hover != null ? { rangeYd: distanceFromDisplay(hover, units), heightIn: heightAt(pts, distanceFromDisplay(hover, units)) } : null;

  const nearestWhole = (clientX: number, rect: DOMRect) => clampWhole(((clientX - rect.left - PAD.left) / iw) * xMax);

  const dUnit = distanceUnit(units);
  const label = (yd: number) => `${trimNumber(hx(yd), 0)} ${dUnit}`;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        className="block touch-none select-none"
        role="img"
        aria-label={`Bullet path relative to the line of sight from 0 to ${label(result.chartMaxYd)}. At the target distance of ${label(targetYd)} it is ${fmtPath(result.offsetIn, units)}.`}
        tabIndex={0}
        onPointerMove={(e) => setHover(nearestWhole(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const cur = hover ?? clampWhole(hx(targetYd));
          const step = e.shiftKey ? 10 : 1;
          setHover(clampWhole(cur + (e.key === "ArrowRight" ? step : -step)));
        }}
        onBlur={() => setHover(null)}
      >
        {/* grid + axes */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11px] tabular-nums">
              {trimNumber(t, 1)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={`x${t}`}
            x={sx(t)}
            y={HEIGHT - PAD.bottom + (compact ? 15 : 18)}
            textAnchor={compact && sx(t) > width - 40 ? "end" : "middle"}
            className="fill-ink-3 font-mono text-[11px] tabular-nums"
          >
            {trimNumber(t, 0)}
            {compact && t === xTicks[xTicks.length - 1] ? ` ${dUnit}` : ""}
          </text>
        ))}
        {!compact && (
          <>
            <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-ink-3 text-[11px]">
              Range ({dUnit})
            </text>
            <text x={12} y={PAD.top + ih / 2} textAnchor="middle" transform={`rotate(-90 12 ${PAD.top + ih / 2})`} className="fill-ink-3 text-[11px]">
              Height vs. line of sight ({yUnit})
            </text>
          </>
        )}

        {/* line of sight */}
        <line x1={PAD.left} x2={width - PAD.right} y1={sy(0)} y2={sy(0)} stroke="var(--ink-2)" strokeWidth={1} />
        {!compact && (
          <text x={width - PAD.right} y={sy(0) - 6} textAnchor="end" className="fill-ink-2 text-[11px]" style={HALO}>
            Line of sight
          </text>
        )}

        {/* bullet path */}
        <path d={path} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* zero crossings */}
        {crossings.map((c, i) => (
          <g key={`c${i}`}>
            <circle cx={sx(hx(c))} cy={sy(0)} r={6} fill="var(--surface)" />
            <circle cx={sx(hx(c))} cy={sy(0)} r={4} fill="var(--ink)" />
            {/* Crossings close together (a zero near the top of the arc) share one label. */}
            {(i === 0 || sx(hx(c)) - sx(hx(crossings[i - 1])) > 80) && (
              <text
                x={sx(hx(c))}
                y={sy(0) + 18}
                textAnchor={sx(hx(c)) > width - 80 ? "end" : "middle"}
                className="fill-ink-2 font-mono text-[11px] tabular-nums"
                style={HALO}
              >
                {Math.abs(c - zeroYd) < 1 ? `zero ${label(zeroYd)}` : label(c)}
              </text>
            )}
          </g>
        ))}

        {/* target distance */}
        <line x1={sx(targetPoint.x)} x2={sx(targetPoint.x)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--accent)" strokeWidth={1} opacity={0.5} />
        <circle cx={sx(targetPoint.x)} cy={sy(targetPoint.y)} r={7} fill="var(--surface)" />
        <circle cx={sx(targetPoint.x)} cy={sy(targetPoint.y)} r={5} fill="var(--accent)" />
        <text x={sx(targetPoint.x) + 10} y={PAD.top + 12} className="fill-ink text-[11px] font-semibold" style={HALO}>
          Target {label(targetYd)}
        </text>

        {/* hover crosshair */}
        {hovered && (
          <g pointerEvents="none">
            <line x1={sx(hx(hovered.rangeYd))} x2={sx(hx(hovered.rangeYd))} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--ink-3)" strokeWidth={1} />
            <circle cx={sx(hx(hovered.rangeYd))} cy={sy(hy(hovered.heightIn))} r={6} fill="var(--surface)" />
            <circle cx={sx(hx(hovered.rangeYd))} cy={sy(hy(hovered.heightIn))} r={4} fill="var(--series)" />
          </g>
        )}
        <rect x={PAD.left} y={PAD.top} width={iw} height={ih} fill="transparent" />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm"
          style={
            sx(hx(hovered.rangeYd)) > width / 2
              ? { right: width - sx(hx(hovered.rangeYd)) + 10 }
              : { left: sx(hx(hovered.rangeYd)) + 10 }
          }
        >
          <div className="font-mono text-sm font-semibold tabular-nums text-ink">
            {hovered.heightIn > 0 ? "+" : ""}
            {fmtPath(hovered.heightIn, units)}
          </div>
          <div className="text-ink-3">
            at {hover} {dUnit}
          </div>
        </div>
      )}
    </div>
  );
}
