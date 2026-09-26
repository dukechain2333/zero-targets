"use client";

import { useState } from "react";
import { barrelPresetsFor } from "@/lib/ammo";
import type { ZeroResult } from "@/lib/compute";
import { OPTIC_HEIGHT_PRESETS, RAIL_TO_BORE_PRESETS, TARGET_DISTANCE_PRESETS, ZERO_PRESETS } from "@/lib/presets";
import { LIMITS, type ResolvedSetup, type Setup } from "@/lib/setup";
import { distanceLabel } from "@/lib/target/scene";
import {
  distanceFromDisplay,
  distanceToDisplay,
  distanceUnit,
  fmtBarrel,
  fmtSightHeight,
  fmtVelocity,
  heightFromDisplay,
  heightToDisplay,
  heightUnit,
  MM_PER_IN,
} from "@/lib/units";
import { AmmoField } from "./ammo-field";
import { ChoiceField } from "./choice-field";

export interface SetupContext {
  setup: Setup;
  resolved: ResolvedSetup;
  result: ZeroResult;
  update: (patch: Partial<Setup>) => void;
  changeLoad: (loadId: string) => void;
  onShowSources: () => void;
  zeroHints: Map<number, string>;
  targetHints: Map<number, string>;
}

export type SectionId = "ammo" | "rifle" | "zero";

// ---------------------------------------------------------------- editors

function RifleEditor({ setup, resolved, update }: SetupContext) {
  const u = setup.units;
  const [editRail, setEditRail] = useState(false);
  const height = {
    toDisplay: (inch: number) => heightToDisplay(inch, u),
    fromDisplay: (v: number) => heightFromDisplay(v, u),
  };
  return (
    <div className="flex flex-col gap-4">
      <ChoiceField
        label="Barrel"
        aside="sets the velocity"
        presets={barrelPresetsFor(resolved.load)}
        value={setup.barrelIn}
        onChange={(barrelIn) => update({ barrelIn })}
        unit="in"
        limits={LIMITS.barrelIn}
        note={u === "metric" ? `${(setup.barrelIn * MM_PER_IN).toFixed(0)} mm` : undefined}
      />
      <ChoiceField
        label="Optic height (riser)"
        aside="rail top to optic center"
        presets={OPTIC_HEIGHT_PRESETS}
        value={setup.opticHeightIn}
        onChange={(opticHeightIn) => update({ opticHeightIn })}
        unit={heightUnit(u)}
        limits={LIMITS.opticHeightIn}
        decimals={u === "metric" ? 1 : 3}
        {...height}
      />
      <div className="flex flex-col gap-3 rounded-lg bg-surface-2 px-2.5 py-2">
        <div className="flex items-center gap-2.5 text-xs text-ink-2">
          <span className="grow">
            Rail to bore <span className="font-mono text-ink">{fmtSightHeight(setup.railToBoreIn, u)}</span> · sight height{" "}
            <span className="font-mono text-ink">{fmtSightHeight(resolved.sightHeightIn, u)}</span>
          </span>
          <button
            type="button"
            aria-expanded={editRail}
            onClick={() => setEditRail((v) => !v)}
            className="h-7 shrink-0 rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink hover:bg-surface-2"
          >
            {editRail ? "Done" : "Change"}
          </button>
        </div>
        {editRail && (
          <>
            <ChoiceField
              label="Bore center to rail top"
              presets={RAIL_TO_BORE_PRESETS}
              value={setup.railToBoreIn}
              onChange={(railToBoreIn) => update({ railToBoreIn })}
              unit={heightUnit(u)}
              limits={LIMITS.railToBoreIn}
              decimals={u === "metric" ? 1 : 3}
              {...height}
            />
            <p className="text-xs text-ink-3">
              Not an AR? Measure from the center of the bore to the center of the optic and subtract the optic height.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ZeroEditor({ setup, update, zeroHints, targetHints }: SetupContext) {
  const u = setup.units;
  const distance = {
    toDisplay: (yd: number) => distanceToDisplay(yd, u),
    fromDisplay: (v: number) => distanceFromDisplay(v, u),
  };
  return (
    <div className="flex flex-col gap-4">
      <ChoiceField
        label="Zero at"
        aside="small: crosses again at"
        presets={ZERO_PRESETS[u]}
        value={setup.zeroYd}
        onChange={(zeroYd) => update({ zeroYd })}
        unit={distanceUnit(u)}
        limits={LIMITS.zeroYd}
        decimals={1}
        hintFor={(v) => zeroHints.get(v)}
        {...distance}
      />
      <ChoiceField
        label="Shooting at"
        aside={`small: offset, ${u === "metric" ? "mm" : "in"}`}
        presets={TARGET_DISTANCE_PRESETS[u]}
        value={setup.targetYd}
        onChange={(targetYd) => update({ targetYd })}
        unit={distanceUnit(u)}
        limits={LIMITS.targetYd}
        decimals={1}
        hintFor={(v) => targetHints.get(v)}
        {...distance}
      />
    </div>
  );
}

// ---------------------------------------------------------------- section list

export const SECTIONS: {
  id: SectionId;
  title: string;
  summary: (c: SetupContext) => string;
  Editor: (c: SetupContext) => React.ReactNode;
}[] = [
  {
    id: "ammo",
    title: "Ammunition",
    summary: ({ setup, resolved }) =>
      `${resolved.load?.name ?? resolved.loadShort} · ${fmtVelocity(resolved.muzzleVelocityFps, setup.units)} ${
        resolved.mvSource === "measured" ? "(chrono)" : "(est.)"
      }`,
    Editor: (c) => (
      <AmmoField setup={c.setup} resolved={c.resolved} onLoadChange={c.changeLoad} onChange={c.update} onShowSources={c.onShowSources} />
    ),
  },
  {
    id: "rifle",
    title: "Rifle and optic",
    summary: ({ setup, resolved }) =>
      `${fmtBarrel(setup.barrelIn)} · ${fmtSightHeight(setup.opticHeightIn, setup.units)} riser · ${fmtSightHeight(
        resolved.sightHeightIn,
        setup.units,
      )} sight`,
    Editor: RifleEditor,
  },
  {
    id: "zero",
    title: "Zero",
    summary: ({ setup }) => `${distanceLabel(setup.zeroYd, setup.units)} zero · shooting at ${distanceLabel(setup.targetYd, setup.units)}`,
    Editor: ZeroEditor,
  },
];

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-ink">
      {n}
    </span>
  );
}

function Chevron({ dir }: { dir: "up" | "down" | "right" }) {
  const d = dir === "up" ? "M6 15l6-6 6 6" : dir === "down" ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6";
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className="shrink-0 text-ink-2">
      <path d={d} />
    </svg>
  );
}

/** Desktop: accordion sections; a closed one shows its values in one line. */
export function SetupRail({ ctx }: { ctx: SetupContext }) {
  const [open, setOpen] = useState<Set<SectionId>>(() => new Set<SectionId>(SECTIONS.map((s) => s.id)));
  const allOpen = open.size === SECTIONS.length;
  const toggle = (id: SectionId) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Setup</h2>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(SECTIONS.map((s) => s.id)))}
          className="py-1 text-xs text-ink-2 hover:text-ink"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      {SECTIONS.map((s, i) => {
        const isOpen = open.has(s.id);
        const Editor = s.Editor;
        return (
          <section
            key={s.id}
            className={`rounded-[10px] bg-surface ${isOpen ? "border-[1.5px] border-primary" : "border border-line"}`}
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`section-${s.id}`}
                onClick={() => toggle(s.id)}
                className={`flex w-full items-center gap-2.5 px-3.5 text-left ${isOpen ? "h-12" : "min-h-14 py-2"}`}
              >
                <StepBadge n={i + 1} />
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-sm font-semibold">{s.title}</span>
                  {!isOpen && <span className="truncate font-mono text-xs text-ink-2">{s.summary(ctx)}</span>}
                </span>
                <Chevron dir={isOpen ? "up" : "down"} />
              </button>
            </h3>
            {isOpen && (
              <div id={`section-${s.id}`} className="px-3.5 pb-4">
                <Editor {...ctx} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Phone: one row per section; tapping a row opens its editor in a sheet. */
export function SetupList({ ctx, onOpen }: { ctx: SetupContext; onOpen: (id: SectionId) => void }) {
  return (
    <section aria-label="Setup" className="rounded-t-2xl bg-surface">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="eyebrow">Setup</h2>
        <span className="text-xs text-ink-3">tap a row to edit</span>
      </div>
      <ul>
        {SECTIONS.map((s) => (
          <li key={s.id} className="border-t border-surface-2">
            <button type="button" onClick={() => onOpen(s.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left">
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-sm font-semibold">{s.title}</span>
                <span className="truncate font-mono text-xs text-ink-2">{s.summary(ctx)}</span>
              </span>
              <Chevron dir="right" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Phone: the full-height editor for one section, with the live result pinned on top. */
export function SectionSheetBody({
  ctx,
  id,
  onDone,
  result,
}: {
  ctx: SetupContext;
  id: SectionId;
  onDone: () => void;
  result: React.ReactNode;
}) {
  const s = SECTIONS.find((x) => x.id === id)!;
  const Editor = s.Editor;
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-surface-2 bg-surface pr-2 pl-1">
        <button type="button" onClick={onDone} className="flex h-11 items-center gap-0.5 px-2 text-sm font-medium text-ink-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Setup
        </button>
        <h2 className="grow text-center text-base font-semibold">{s.title}</h2>
        <button type="button" onClick={onDone} className="h-11 px-3 text-[15px] font-semibold">
          Done
        </button>
      </div>
      <div className="sticky top-14 z-10 bg-surface px-4 pt-3">{result}</div>
      <div className="px-4 pt-4 pb-8">
        <Editor {...ctx} />
      </div>
    </div>
  );
}
