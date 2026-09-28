"use client";

import type { BallisticTable, TableRow } from "@/lib/ballistic-table";
import type { ZeroResult } from "@/lib/compute";
import { CLICK_PRESETS, PAPER_SIZES, TABLE_RANGE_PRESETS, TABLE_STEP_PRESETS, type AngularUnit } from "@/lib/presets";
import type { Setup } from "@/lib/setup";
import { fmtAngle, fmtLength } from "@/lib/target/ballistics-pages";
import { distanceLabel, unitLabel } from "@/lib/target/scene";
import { distanceToDisplay, distanceUnit, fmtOffset, trimNumber, type UnitSystem } from "@/lib/units";
import type { DocTab } from "./desk";
import { TrajectoryChart } from "./trajectory-chart";

const roundDistance = (yd: number, u: UnitSystem) => `${Math.round(distanceToDisplay(yd, u))} ${distanceUnit(u)}`;

function direction(offsetIn: number) {
  const d = Math.abs(offsetIn);
  return d < 0.005 ? "on" : offsetIn < 0 ? "low" : "high";
}

// ---------------------------------------------------------------- result

/** "AT 25 YD, YOUR GROUP HITS 1.25 in LOW". */
export function ResultHero({
  setup,
  result,
  unit,
  size = "lg",
  detail = true,
}: {
  setup: Setup;
  result: ZeroResult;
  unit: AngularUnit;
  size?: "lg" | "md";
  /** The "4.8 MOA below the aim point" line (the phone strip shows it beside the number instead). */
  detail?: boolean;
}) {
  const u = setup.units;
  const where = direction(result.offsetIn);
  const angle = Math.abs(unit === "moa" ? result.offsetMoa : result.offsetMil);
  const big = size === "lg" ? "text-[72px]" : "text-[44px]";
  const word = size === "lg" ? "text-[34px]" : "text-2xl";
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <span className="eyebrow text-[13px] desk:text-[15px]">At {distanceLabel(setup.targetYd, u)}, your group hits</span>
      <div className="flex items-baseline gap-2.5">
        {where === "on" ? (
          <span className={`font-display ${word} leading-none font-bold`}>ON THE AIM POINT</span>
        ) : (
          <>
            <span className={`font-display ${big} leading-[0.95] font-bold`}>{fmtOffset(Math.abs(result.offsetIn), u)}</span>
            <span className={`font-display ${word} font-bold text-accent`}>{where.toUpperCase()}</span>
          </>
        )}
      </div>
      {detail && where !== "on" && (
        <span className="text-[13px] text-ink-2">
          {angle.toFixed(1)} {unitLabel(unit)} {where === "low" ? "below" : "above"} the aim point, for a{" "}
          {distanceLabel(setup.zeroYd, u)} zero
        </span>
      )}
    </div>
  );
}

/** Dark pill pinned on top of the phone editors. */
export function ResultPill({ setup, result, unit }: { setup: Setup; result: ZeroResult; unit: AngularUnit }) {
  const u = setup.units;
  const where = direction(result.offsetIn);
  const angle = Math.abs(unit === "moa" ? result.offsetMoa : result.offsetMil);
  return (
    <div className="flex items-center justify-between rounded-[10px] bg-primary px-3.5 py-2.5 text-primary-ink" aria-live="polite">
      <span className="flex items-baseline gap-2">
        <span className="text-xs opacity-80">At {distanceLabel(setup.targetYd, u)}</span>
        {where === "on" ? (
          <span className="font-display text-xl font-bold">on the aim point</span>
        ) : (
          <>
            <span className="font-display text-[28px] leading-none font-bold">{fmtOffset(Math.abs(result.offsetIn), u)}</span>
            <span className="font-display text-[17px] font-bold text-accent-on-primary">{where.toUpperCase()}</span>
          </>
        )}
      </span>
      <span className="font-mono text-xs opacity-80">
        {angle.toFixed(1)} {unitLabel(unit)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- quick facts

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-ground px-3 py-2.5">
      <span className="text-[11px] text-ink-2">{label}</span>
      <span className="font-mono text-[15px] font-semibold tabular-nums">{value}</span>
      {note && <span className="text-[11px] text-ink-3">{note}</span>}
    </div>
  );
}

function correctionFact(row: TableRow, table: BallisticTable, u: UnitSystem) {
  const clicks = Math.abs(row.elevationClicks);
  const dir = row.elevation >= 0 ? "U" : "D";
  const low = row.pathIn < 0;
  return {
    label: `At ${roundDistance(row.rangeYd, u)}`,
    value: `${dir} ${fmtAngle(row.elevation, table.unit, false)} ${unitLabel(table.unit)}`,
    note: `${clicks} click${clicks === 1 ? "" : "s"} · ${fmtLength(row.pathIn, u, false)} ${u === "metric" ? "cm" : "in"} ${low ? "low" : "high"}`,
  };
}

export function QuickFacts({
  setup,
  result,
  table,
  tab,
  onExpandChart,
}: {
  setup: Setup;
  result: ZeroResult;
  table: BallisticTable;
  tab: DocTab;
  /** Opens the bullet path chart in a large dialog. */
  onExpandChart: () => void;
}) {
  const u = setup.units;
  if (tab === "cards" || tab === "table") {
    const rows = table.rows;
    if (rows.length === 0) return null;
    const last = rows[rows.length - 1];
    // A mid-range reference (300 yd or m) plus the table's last row.
    const mid =
      rows.find((r) => Math.abs(distanceToDisplay(r.rangeYd, u) - 300) < 0.5 && r !== last) ??
      rows[Math.floor((rows.length - 1) / 2)];
    const facts = mid && mid !== last ? [correctionFact(mid, table, u), correctionFact(last, table, u)] : [correctionFact(last, table, u)];
    return (
      <div className="grid grid-cols-2 gap-2">
        {facts.map((f) => (
          <Fact key={f.label} {...f} />
        ))}
      </div>
    );
  }
  const [near, far] = result.crossingsYd;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Fact
          label="Crosses sight line"
          value={near != null ? [near, far].filter((d) => d != null).map((d) => Math.round(distanceToDisplay(d, u))).join(" · ") + ` ${distanceUnit(u)}` : "–"}
        />
        <Fact
          label="Peak height"
          value={result.apex ? `+${fmtOffset(result.apex.heightIn, u)}` : "–"}
          note={result.apex ? `at ${roundDistance(result.apex.rangeYd, u)}` : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-2">Bullet path</span>
          <button
            type="button"
            onClick={onExpandChart}
            className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
            </svg>
            Enlarge
          </button>
        </div>
        {/* The small chart is a preview: a click opens the large one (hover still reads values). */}
        <div onClick={onExpandChart} className="cursor-zoom-in">
          <TrajectoryChart result={result} units={u} targetYd={setup.targetYd} zeroYd={setup.zeroYd} height={170} compact />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- print pack

export interface PackInclude {
  target: boolean;
  guide: boolean;
  cards: boolean;
  table: boolean;
}

interface PrintPackProps {
  setup: Setup;
  update: (patch: Partial<Setup>) => void;
  include: PackInclude;
  onInclude: (i: PackInclude) => void;
  tablePageCount: number;
  targetFits: boolean;
  busy: "download" | "open" | null;
  onDownload: () => void;
  onOpen: () => void;
  /** Phone sheet: also offer the table range and step (desktop has them in the desk toolbar). */
  withTableSettings?: boolean;
  /** Phone sheet: descriptions and bigger rows. */
  roomy?: boolean;
}

export function packPageCount(include: PackInclude, tablePageCount: number) {
  return (include.target ? 1 : 0) + (include.guide ? 1 : 0) + (include.cards ? 1 : 0) + (include.table ? tablePageCount : 0);
}

const selectClass = "h-[34px] rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink";

export function PrintPack(props: PrintPackProps) {
  const { setup, include, roomy } = props;
  const u = setup.units;
  const pages = packPageCount(include, props.tablePageCount);
  const blocked = include.target && !props.targetFits;
  const items: { key: keyof PackInclude; label: string; desc: string; count: number }[] = [
    {
      key: "target",
      label: "Zero target",
      desc: `${distanceLabel(setup.targetYd, u)} target for a ${distanceLabel(setup.zeroYd, u)} zero`,
      count: 1,
    },
    { key: "guide", label: "Zeroing guide", desc: "steps and click counts for this setup", count: 1 },
    { key: "cards", label: "Ballistic cards", desc: `cut-out cards out to ${distanceLabel(setup.tableMaxYd, u)}`, count: 1 },
    {
      key: "table",
      label: "Ballistic table",
      desc: `every ${distanceLabel(setup.tableStepYd, u)} to ${distanceLabel(setup.tableMaxYd, u)}`,
      count: props.tablePageCount,
    },
  ];
  const rangeOptions = (presets: typeof TABLE_RANGE_PRESETS.imperial, value: number) => {
    const has = presets.some((p) => Math.abs(p.value - value) < 1e-6);
    return (
      <>
        {!has && <option value={String(value)}>{trimNumber(distanceToDisplay(value, u), 1)} {distanceUnit(u)}</option>}
        {presets.map((p) => (
          <option key={p.label} value={String(p.value)}>
            {p.label} {distanceUnit(u)}
          </option>
        ))}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset className={`flex flex-col ${roomy ? "rounded-xl border border-line" : "gap-2"}`}>
        <legend className="sr-only">Documents in the PDF</legend>
        {items.map((it, i) => (
          <label
            key={it.key}
            className={`flex cursor-pointer items-center gap-2.5 text-sm ${roomy ? `min-h-14 px-3.5 py-2 ${i > 0 ? "border-t border-surface-2" : ""}` : ""}`}
          >
            <input
              type="checkbox"
              checked={include[it.key]}
              onChange={(e) => props.onInclude({ ...include, [it.key]: e.target.checked })}
              className="size-[18px] shrink-0 accent-[var(--primary)]"
            />
            <span className="flex min-w-0 grow flex-col">
              <span className={roomy ? "font-semibold" : ""}>{it.label}</span>
              {roomy && <span className="text-xs text-ink-3">{it.desc}</span>}
            </span>
            <span className="font-mono text-xs text-ink-3">{it.count} p</span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-ink-2">
          Paper
          <select value={setup.paperId} onChange={(e) => props.update({ paperId: e.target.value })} className={selectClass}>
            {PAPER_SIZES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-2">
          Turret clicks
          <select value={setup.clickId} onChange={(e) => props.update({ clickId: e.target.value })} className={selectClass}>
            {CLICK_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {props.withTableSettings && (
          <>
            <label className="flex flex-col gap-1 text-[11px] text-ink-2">
              Cards and table out to
              <select
                value={String(setup.tableMaxYd)}
                onChange={(e) => props.update({ tableMaxYd: Number(e.target.value) })}
                className={selectClass}
              >
                {rangeOptions(TABLE_RANGE_PRESETS[u], setup.tableMaxYd)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-2">
              Table step
              <select
                value={String(setup.tableStepYd)}
                onChange={(e) => props.update({ tableStepYd: Number(e.target.value) })}
                className={selectClass}
              >
                {rangeOptions(TABLE_STEP_PRESETS[u], setup.tableStepYd)}
              </select>
            </label>
          </>
        )}
      </div>

      {blocked && (
        <p className="rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-ink">
          AIM and IMPACT don&apos;t both fit on this paper. Pick a larger size, move the target closer to your zero
          distance, or leave the zero target out.
        </p>
      )}

      <button
        type="button"
        onClick={props.onDownload}
        disabled={pages === 0 || blocked || props.busy != null}
        className="flex h-12 items-center justify-center gap-2.5 rounded-[9px] bg-primary text-[15px] font-semibold text-primary-ink disabled:opacity-50"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        {props.busy === "download" ? "Preparing…" : pages === 0 ? "Pick a document" : `Download PDF · ${pages} page${pages === 1 ? "" : "s"}`}
      </button>
      <button
        type="button"
        onClick={props.onOpen}
        disabled={pages === 0 || blocked || props.busy != null}
        className="h-9 rounded-lg text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
      >
        {props.busy === "open" ? "Preparing…" : "Open to print"}
      </button>
    </div>
  );
}
