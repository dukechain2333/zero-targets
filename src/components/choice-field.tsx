"use client";

import { useId, useState } from "react";
import type { Preset } from "@/lib/presets";
import { trimNumber } from "@/lib/units";

interface ChoiceFieldProps {
  label: string;
  /** Short note to the right of the label (e.g. what the chip hints mean). */
  aside?: string;
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
  /** Second line inside each chip: what picking that preset leads to. */
  hintFor?: (canonical: number) => string | undefined;
  /** Shown under the chips (defaults to the chosen preset's hint). */
  note?: React.ReactNode;
}

const identity = (v: number) => v;
const EPS = 1e-6;

/** Preset chips plus an "Other" input that lives in the same row. */
export function ChoiceField({
  label,
  aside,
  presets,
  value,
  onChange,
  unit,
  limits,
  toDisplay = identity,
  fromDisplay = identity,
  decimals = 2,
  hintFor,
  note,
}: ChoiceFieldProps) {
  const id = useId();
  const matched = presets.find((p) => Math.abs(p.value - value) < EPS);
  const [draft, setDraft] = useState<string | null>(null);
  const custom = !matched;
  const tall = hintFor != null;

  const text = draft ?? (custom ? trimNumber(toDisplay(value), decimals) : "");
  const n = Number(text);
  const invalid =
    draft != null &&
    draft.trim() !== "" &&
    (!Number.isFinite(n) || fromDisplay(n) < limits[0] - EPS || fromDisplay(n) > limits[1] + EPS);
  const lo = trimNumber(toDisplay(limits[0]), decimals);
  const hi = trimNumber(toDisplay(limits[1]), decimals);

  const chipBase = `flex flex-col items-center justify-center rounded-[7px] border font-mono tabular-nums transition-colors ${
    tall ? "h-12 w-14 gap-px" : "h-9 min-w-[50px] px-2"
  }`;

  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span id={`${id}-label`} className="font-medium text-ink-2">
          {label}
          {unit && <span className="font-normal text-ink-3">, {unit}</span>}
        </span>
        {aside && <span className="text-right text-ink-3">{aside}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const on = matched === p;
          const hint = hintFor?.(p.value);
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={on}
              title={p.hint}
              onClick={() => {
                setDraft(null);
                onChange(p.value);
              }}
              className={`${chipBase} ${
                on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:border-line-strong"
              }`}
            >
              <span className={tall ? `text-[15px] ${on ? "font-semibold" : "font-medium"}` : `text-sm ${on ? "font-semibold" : ""}`}>
                {p.label}
              </span>
              {tall && <span className={`text-[10px] ${on ? "opacity-75" : "text-ink-3"}`}>{hint ?? " "}</span>}
            </button>
          );
        })}
        <label
          className={`flex items-center gap-1 rounded-[7px] border px-2.5 transition-colors focus-within:border-series ${
            tall ? "h-12 w-[118px]" : "h-9 w-[104px]"
          } ${
            invalid
              ? "border-accent bg-surface"
              : custom
                ? "border-primary bg-surface"
                : "border-dashed border-line-strong bg-ground"
          }`}
        >
          <span className="sr-only">
            Other {label.toLowerCase()} in {unit}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="Other"
            value={text}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-err` : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              const v = Number(raw);
              if (raw.trim() !== "" && Number.isFinite(v)) {
                const canonical = fromDisplay(v);
                if (canonical >= limits[0] - EPS && canonical <= limits[1] + EPS) onChange(canonical);
              }
            }}
            onBlur={() => setDraft(null)}
            className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-ink outline-none placeholder:font-sans placeholder:text-ink-3 focus-visible:outline-none"
          />
          {custom && !invalid && <span className="text-xs text-ink-3">{unit}</span>}
        </label>
      </div>
      {invalid ? (
        <p id={`${id}-err`} className="text-xs text-accent">
          Enter {lo} to {hi} {unit}.
        </p>
      ) : (
        (note ?? matched?.hint) && <p className="text-xs text-ink-2">{note ?? matched?.hint}</p>
      )}
    </div>
  );
}
