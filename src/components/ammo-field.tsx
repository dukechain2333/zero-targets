"use client";

import { useId, useState } from "react";
import { loadGroups } from "@/lib/ammo";
import type { ResolvedSetup, Setup } from "@/lib/setup";
import { CUSTOM_LOAD_ID, LIMITS } from "@/lib/setup";
import {
  fmtBarrel,
  fmtVelocity,
  trimNumber,
  velocityFromDisplay,
  velocityToDisplay,
  velocityUnit,
} from "@/lib/units";

interface Props {
  setup: Setup;
  resolved: ResolvedSetup;
  onLoadChange: (loadId: string) => void;
  onChange: (patch: Partial<Setup>) => void;
}

const inputBox =
  "flex h-9 items-center rounded-md border border-line-strong bg-surface pr-2.5 focus-within:border-series";
const inputEl =
  "h-full w-full min-w-0 bg-transparent px-2.5 font-mono text-sm tabular-nums text-ink outline-none focus-visible:outline-none";

/** Number input that only commits values inside `limits` and restores the last good value on blur. */
function NumberInput({
  id,
  value,
  onCommit,
  limits,
  unit,
  decimals = 3,
  label,
}: {
  id: string;
  value: number;
  onCommit: (v: number) => void;
  limits: readonly [number, number];
  unit?: string;
  decimals?: number;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? trimNumber(value, decimals);
  const n = Number(text);
  const invalid = draft != null && (text.trim() === "" || !Number.isFinite(n) || n < limits[0] || n > limits[1]);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-ink-2">
        {label}
      </label>
      <div className={`${inputBox} ${invalid ? "!border-accent" : ""}`}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          aria-invalid={invalid}
          onChange={(e) => {
            setDraft(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= limits[0] && v <= limits[1]) onCommit(v);
          }}
          onBlur={() => setDraft(null)}
          className={inputEl}
        />
        {unit && <span className="text-sm text-ink-3">{unit}</span>}
      </div>
      {invalid && (
        <p className="text-xs text-accent">
          {trimNumber(limits[0], decimals)} to {trimNumber(limits[1], decimals)}
          {unit ? ` ${unit}` : ""}
        </p>
      )}
    </div>
  );
}

/** Expand the sources section before the browser jumps to it. */
function openSources() {
  const el = document.getElementById("ammo-data");
  if (el instanceof HTMLDetailsElement) el.open = true;
}

export function AmmoField({ setup, resolved, onLoadChange, onChange }: Props) {
  const id = useId();
  const groups = loadGroups();
  const isCustom = setup.loadId === CUSTOM_LOAD_ID;
  const u = setup.units;
  const vUnit = velocityUnit(u);
  const mvLimits = [velocityToDisplay(LIMITS.mvFps[0], u), velocityToDisplay(LIMITS.mvFps[1], u)] as const;
  const load = resolved.load;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={`${id}-load`} className="text-sm font-semibold text-ink">
          Load
        </label>
        <select
          id={`${id}-load`}
          value={setup.loadId}
          onChange={(e) => onLoadChange(e.target.value)}
          className="h-10 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink"
        >
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.loads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Other">
            <option value={CUSTOM_LOAD_ID}>Custom load (enter bullet data)</option>
          </optgroup>
        </select>
        {load && (
          <p className="text-xs text-ink-2">
            {load.group} · {load.dragModel} BC {load.bc} · velocity data: {load.confidence} confidence{" "}
            <a href="#ammo-data" onClick={openSources} className="text-ink-3 underline underline-offset-2 hover:text-ink">
              sources
            </a>
          </p>
        )}
        {load && <p className="text-xs text-ink-3">{load.notes}</p>}
      </div>

      {isCustom && (
        <div className="grid grid-cols-3 gap-3">
          <NumberInput
            id={`${id}-w`}
            label="Bullet weight"
            unit="gr"
            decimals={1}
            value={setup.customLoad.weightGr}
            limits={LIMITS.weightGr}
            onCommit={(weightGr) => onChange({ customLoad: { ...setup.customLoad, weightGr } })}
          />
          <NumberInput
            id={`${id}-bc`}
            label="Ballistic coeff."
            value={setup.customLoad.bc}
            limits={LIMITS.bc}
            onCommit={(bc) => onChange({ customLoad: { ...setup.customLoad, bc } })}
          />
          <div className="space-y-1">
            <span className="block text-xs font-medium text-ink-2">Drag model</span>
            <div className="flex h-9 rounded-md border border-line-strong p-0.5">
              {(["G1", "G7"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={setup.customLoad.dragModel === m}
                  onClick={() => onChange({ customLoad: { ...setup.customLoad, dragModel: m } })}
                  className={`flex-1 rounded text-sm ${
                    setup.customLoad.dragModel === m ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border border-line bg-surface-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-ink-2">Muzzle velocity</div>
            <div className="font-mono text-lg font-semibold tabular-nums text-ink">
              {fmtVelocity(resolved.muzzleVelocityFps, u)}
            </div>
            <div className="text-xs text-ink-3">
              {resolved.mvSource === "measured"
                ? isCustom
                  ? "Entered for your custom load"
                  : "Your chronograph value"
                : `Estimated for a ${fmtBarrel(setup.barrelIn)} barrel from published data`}
            </div>
          </div>
          {!isCustom && (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5 text-xs text-ink-2">
              <input
                type="checkbox"
                checked={setup.mvOverrideFps != null}
                onChange={(e) =>
                  onChange({ mvOverrideFps: e.target.checked ? Math.round(resolved.muzzleVelocityFps) : null })
                }
                className="size-4 accent-[var(--ink)]"
              />
              I chronographed it
            </label>
          )}
        </div>
        {resolved.mvSource === "extrapolated" && (
          <p className="mt-2 text-xs text-warn-ink">
            This barrel is outside the published data for this load, so the velocity is extrapolated. Enter a
            chronograph value if you have one.
          </p>
        )}
        {(setup.mvOverrideFps != null || isCustom) && (
          <div className="mt-3 w-44">
            <NumberInput
              id={`${id}-mv`}
              label={`Measured velocity`}
              unit={vUnit}
              decimals={0}
              value={velocityToDisplay(resolved.muzzleVelocityFps, u)}
              limits={mvLimits}
              onCommit={(v) => onChange({ mvOverrideFps: velocityFromDisplay(v, u) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
