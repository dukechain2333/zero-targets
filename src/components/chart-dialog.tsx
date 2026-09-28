"use client";

import type { ZeroResult } from "@/lib/compute";
import type { Setup } from "@/lib/setup";
import { distanceLabel } from "@/lib/target/scene";
import { distanceToDisplay, distanceUnit, fmtBarrel, fmtOffset, fmtSightHeight, fmtVelocity } from "@/lib/units";
import { TrajectoryChart } from "./trajectory-chart";

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-ground px-3 py-2.5">
      <span className="text-xs text-ink-2">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums">{value}</span>
      {note && <span className="text-xs text-ink-3">{note}</span>}
    </div>
  );
}

/** The bullet path at full size, opened from the small chart in the inspector. */
export function ChartDialogBody({
  setup,
  result,
  onClose,
  chartHeight,
}: {
  setup: Setup;
  result: ZeroResult;
  onClose: () => void;
  chartHeight: number;
}) {
  const u = setup.units;
  const { resolved } = result;
  const [near, far] = result.crossingsYd;
  const round = (yd: number) => Math.round(distanceToDisplay(yd, u));
  const where = Math.abs(result.offsetIn) < 0.005 ? "on aim" : result.offsetIn < 0 ? "low" : "high";

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface py-2 pr-2 pl-5">
        <div className="flex min-w-0 flex-col">
          <h2 className="font-display text-2xl font-bold">Bullet path</h2>
          <p className="truncate text-xs text-ink-3">
            {resolved.loadShort} · {fmtVelocity(resolved.muzzleVelocityFps, u)} · {fmtBarrel(setup.barrelIn)} barrel ·{" "}
            {fmtSightHeight(resolved.sightHeightIn, u)} sight height · {distanceLabel(setup.zeroYd, u)} zero
          </p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-4 pb-6">
        <p className="text-sm text-ink-2">
          Height of the bullet above or below your line of sight. Hover, or focus the chart and use the arrow keys, to
          read any range.
        </p>
        <TrajectoryChart result={result} units={u} targetYd={setup.targetYd} zeroYd={setup.zeroYd} height={chartHeight} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact
            label={`At ${distanceLabel(setup.targetYd, u)} (your target)`}
            value={where === "on aim" ? "on aim" : `${fmtOffset(Math.abs(result.offsetIn), u)} ${where}`}
          />
          <Fact
            label="Crosses sight line"
            value={
              near != null
                ? `${[near, far].filter((d) => d != null).map((d) => round(d)).join(" · ")} ${distanceUnit(u)}`
                : "–"
            }
          />
          <Fact
            label="Peak height"
            value={result.apex ? `+${fmtOffset(result.apex.heightIn, u)}` : "–"}
            note={result.apex ? `at ${round(result.apex.rangeYd)} ${distanceUnit(u)}` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
