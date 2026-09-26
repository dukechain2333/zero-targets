"use client";

import { useState } from "react";
import { trimNumber } from "@/lib/units";

/** Number input that only commits values inside `limits` and restores the last good value on blur. */
export function NumberInput({
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      <div
        className={`flex h-9 items-center gap-1.5 rounded-md border bg-surface pr-2.5 focus-within:border-series ${
          invalid ? "border-accent" : "border-line-strong"
        }`}
      >
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
          className="h-full w-full min-w-0 bg-transparent px-2.5 font-mono text-sm tabular-nums text-ink outline-none focus-visible:outline-none"
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
