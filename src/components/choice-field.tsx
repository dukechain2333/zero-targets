"use client";

import { useId, useState } from "react";
import type { Preset } from "@/lib/presets";
import { trimNumber } from "@/lib/units";

interface ChoiceFieldProps {
  label: string;
  description?: string;
  /** Presets in canonical units. */
  presets: Preset[];
  /** Current value in canonical units. */
  value: number;
  onChange: (canonical: number) => void;
  unit: string;
  /** Allowed range in canonical units. */
  limits: readonly [number, number];
  toDisplay?: (canonical: number) => number;
  fromDisplay?: (display: number) => number;
  decimals?: number;
  /** Shown under the chips for the chosen value (e.g. converted units). */
  note?: React.ReactNode;
}

const identity = (v: number) => v;
const EPS = 1e-6;

/** Common values as chips, plus a free-form custom value. */
export function ChoiceField({
  label,
  description,
  presets,
  value,
  onChange,
  unit,
  limits,
  toDisplay = identity,
  fromDisplay = identity,
  decimals = 2,
  note,
}: ChoiceFieldProps) {
  const id = useId();
  const matched = presets.find((p) => Math.abs(p.value - value) < EPS);
  const [customWanted, setCustomWanted] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const customActive = customWanted || !matched;

  const shown = trimNumber(toDisplay(value), decimals);
  const text = draft ?? shown;
  const lo = trimNumber(toDisplay(limits[0]), decimals);
  const hi = trimNumber(toDisplay(limits[1]), decimals);
  const parsed = Number(text);
  const invalid =
    draft != null &&
    (text.trim() === "" || !Number.isFinite(parsed) || fromDisplay(parsed) < limits[0] - EPS || fromDisplay(parsed) > limits[1] + EPS);

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-semibold text-ink">
          {label}
        </span>
        {description && <span className="text-xs text-ink-3">{description}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const on = !customActive && matched === p;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              title={p.hint}
              onClick={() => {
                setCustomWanted(false);
                setDraft(null);
                onChange(p.value);
              }}
              className={`h-9 min-w-12 rounded-md border px-2.5 font-mono text-sm tabular-nums transition-colors ${
                on
                  ? "border-primary bg-primary text-primary-ink"
                  : "border-line bg-surface text-ink hover:border-line-strong"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={customActive}
          onClick={() => {
            setCustomWanted(true);
            requestAnimationFrame(() => document.getElementById(`${id}-input`)?.focus());
          }}
          className={`h-9 rounded-md border px-3 text-sm transition-colors ${
            customActive
              ? "border-primary bg-primary text-primary-ink"
              : "border-dashed border-line-strong bg-transparent text-ink-2 hover:text-ink"
          }`}
        >
          Custom
        </button>
      </div>

      {customActive && (
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-input`} className="sr-only">
            Custom {label.toLowerCase()} in {unit}
          </label>
          <div
            className={`flex h-9 w-40 items-center rounded-md border bg-surface pr-2.5 focus-within:border-series ${
              invalid ? "border-accent" : "border-line-strong"
            }`}
          >
            <input
              id={`${id}-input`}
              type="number"
              inputMode="decimal"
              step="any"
              value={text}
              aria-invalid={invalid}
              aria-describedby={`${id}-range`}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const n = Number(raw);
                if (raw.trim() !== "" && Number.isFinite(n)) {
                  const canonical = fromDisplay(n);
                  if (canonical >= limits[0] - EPS && canonical <= limits[1] + EPS) onChange(canonical);
                }
              }}
              onBlur={() => setDraft(null)}
              className="h-full w-full min-w-0 bg-transparent px-2.5 font-mono text-sm tabular-nums text-ink outline-none focus-visible:outline-none"
            />
            <span className="text-sm text-ink-3">{unit}</span>
          </div>
          <span id={`${id}-range`} className={`text-xs ${invalid ? "text-accent" : "text-ink-3"}`}>
            {lo} to {hi} {unit}
          </span>
        </div>
      )}

      {(note || (matched?.hint && !customActive)) && (
        <p className="text-xs text-ink-2">{note ?? matched?.hint}</p>
      )}
    </div>
  );
}
