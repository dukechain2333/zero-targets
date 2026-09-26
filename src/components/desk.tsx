"use client";

import { useEffect, useRef, useState } from "react";
import type { BallisticTable } from "@/lib/ballistic-table";
import type { ZeroResult } from "@/lib/compute";
import type { Guide } from "@/lib/guide";
import { TABLE_RANGE_PRESETS, TABLE_STEP_PRESETS, type Preset } from "@/lib/presets";
import { LIMITS, type Setup } from "@/lib/setup";
import type { PageScene, TargetScene } from "@/lib/target/scene";
import { distanceFromDisplay, distanceToDisplay, distanceUnit, trimNumber } from "@/lib/units";
import { BallisticTableView } from "./ballistic-table-view";
import { GuidePage } from "./guide-page";
import { PagePreview } from "./page-preview";

export type DocTab = "target" | "guide" | "cards" | "table";
export type Zoom = "fit" | "actual";

const TABS: { id: DocTab; label: string }[] = [
  { id: "target", label: "Zero target" },
  { id: "guide", label: "Guide" },
  { id: "cards", label: "Cards" },
  { id: "table", label: "Table" },
];

const CSS_PX_PER_IN = 96;

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 640, h: 800 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** A <select> of presets with an "Other…" entry that turns into a number field. Dark, for the desk toolbar. */
function DeskSelect({
  label,
  presets,
  value,
  onChange,
  units,
  limits,
}: {
  label: string;
  presets: Preset[];
  value: number;
  onChange: (yd: number) => void;
  units: Setup["units"];
  limits: readonly [number, number];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const unit = distanceUnit(units);
  const shown = trimNumber(distanceToDisplay(value, units), 1);
  const isPreset = presets.some((p) => Math.abs(p.value - value) < 1e-6);
  const control = "h-[30px] rounded-md border border-desk-control bg-desk-raised font-mono text-[13px] text-desk-ink";

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) {
      const yd = distanceFromDisplay(n, units);
      if (yd >= limits[0] && yd <= limits[1]) onChange(yd);
    }
    setEditing(false);
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-desk-ink">
      {label}
      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          value={draft}
          placeholder={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className={`${control} w-20 px-2 outline-none focus-visible:border-series`}
        />
      ) : (
        <select
          value={isPreset ? String(value) : "current"}
          onChange={(e) => {
            if (e.target.value === "other") {
              setDraft("");
              setEditing(true);
            } else if (e.target.value !== "current") onChange(Number(e.target.value));
          }}
          className={`${control} px-1.5`}
        >
          {!isPreset && (
            <option value="current">
              {shown} {unit}
            </option>
          )}
          {presets.map((p) => (
            <option key={p.label} value={String(p.value)}>
              {p.label} {unit}
            </option>
          ))}
          <option value="other">Other…</option>
        </select>
      )}
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-[7px] border border-desk-control p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded-[5px] px-2.5 text-xs font-medium ${
            value === o.value ? "bg-desk-control text-white" : "text-desk-ink hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface DeskProps {
  tab: DocTab;
  onTab: (t: DocTab) => void;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  tableView: "page" | "data";
  onTableView: (v: "page" | "data") => void;
  /** Desktop: pages fit the desk's height; phone: they fit its width. */
  constrained: boolean;
  paperLabel: string;
  scene: TargetScene;
  guide: Guide;
  cards: PageScene | null;
  tablePages: PageScene[];
  setup: Setup;
  update: (patch: Partial<Setup>) => void;
  result: ZeroResult;
  table: BallisticTable;
}

export function Desk(props: DeskProps) {
  const { tab, zoom, constrained, scene, setup } = props;
  const [ref, size] = useSize<HTMLDivElement>();
  const pad = constrained ? 22 : 16;
  const aspect = scene.widthIn / scene.heightIn;
  const availW = Math.max(200, size.w - 2 * pad);
  const fitW = constrained ? Math.min(availW, (size.h - 2 * pad) * aspect) : Math.min(availW, 560);
  const pageW = zoom === "actual" ? scene.widthIn * CSS_PX_PER_IN : Math.max(200, fitW);
  const pages: { scene: PageScene; label: string }[] =
    tab === "target"
      ? [{ scene, label: `Preview of the printable target: ${scene.title}` }]
      : tab === "cards" && props.cards
        ? [{ scene: props.cards, label: "Preview of the ballistic cards page" }]
        : tab === "table"
          ? props.tablePages.map((p, i) => ({ scene: p, label: `Preview of ballistic table page ${i + 1}` }))
          : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-desk-line px-3 py-2.5 desk:px-4.5">
        <div role="tablist" aria-label="Document" className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => props.onTab(t.id)}
              className={`h-[34px] shrink-0 rounded-[7px] px-3.5 text-[13px] ${
                tab === t.id ? "bg-[#f3f1ea] font-semibold text-[#17160f]" : "font-medium text-desk-ink hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grow" />
        {(tab === "cards" || tab === "table") && (
          <div className="hidden items-center gap-3 desk:flex">
            <DeskSelect
              label="Out to"
              presets={TABLE_RANGE_PRESETS[setup.units]}
              value={setup.tableMaxYd}
              onChange={(tableMaxYd) => props.update({ tableMaxYd })}
              units={setup.units}
              limits={LIMITS.tableMaxYd}
            />
            {tab === "table" && (
              <DeskSelect
                label="Step"
                presets={TABLE_STEP_PRESETS[setup.units]}
                value={setup.tableStepYd}
                onChange={(tableStepYd) => props.update({ tableStepYd })}
                units={setup.units}
                limits={LIMITS.tableStepYd}
              />
            )}
          </div>
        )}
        {tab === "table" && (
          <Segmented
            label="Table view"
            value={props.tableView}
            onChange={props.onTableView}
            options={[
              { value: "page", label: "Page" },
              { value: "data", label: "Data" },
            ]}
          />
        )}
        {tab === "target" && (
          <span className="hidden font-mono text-xs text-desk-muted desk:inline">{props.paperLabel} · prints 1:1</span>
        )}
        <div className="hidden desk:block">
          <Segmented
            label="Zoom"
            value={zoom}
            onChange={props.onZoom}
            options={[
              { value: "fit", label: "Fit" },
              { value: "actual", label: "100%" },
            ]}
          />
        </div>
      </div>

      <div ref={ref} role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="relative min-h-0 grow overflow-auto">
        <div
          className="flex min-h-full flex-col items-center justify-center gap-6"
          style={{ padding: pad, width: zoom === "actual" ? "max-content" : undefined, minWidth: "100%" }}
        >
          {tab === "guide" ? (
            <GuidePage guide={props.guide} width={zoom === "actual" ? scene.widthIn * CSS_PX_PER_IN : Math.min(availW, 760)} />
          ) : tab === "table" && props.tableView === "data" ? (
            <div className="w-full max-w-5xl">
              <BallisticTableView setup={setup} result={props.result} table={props.table} />
            </div>
          ) : (
            pages.map((p, i) => (
              <div key={i} className="shrink-0 bg-white" style={{ width: pageW, boxShadow: "var(--paper-shadow)" }}>
                <PagePreview scene={p.scene} label={p.label} className="block h-auto w-full" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
