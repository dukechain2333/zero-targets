"use client";

import { useId } from "react";
import type { ResolvedSetup, Setup } from "@/lib/setup";
import { CUSTOM_LOAD_ID, LIMITS } from "@/lib/setup";
import { fmtBarrel, fmtVelocity, velocityFromDisplay, velocityToDisplay, velocityUnit } from "@/lib/units";
import { LoadPicker } from "./load-picker";
import { NumberInput } from "./number-input";

interface Props {
  setup: Setup;
  resolved: ResolvedSetup;
  onLoadChange: (loadId: string) => void;
  onChange: (patch: Partial<Setup>) => void;
  onShowSources: () => void;
}

const smallButton =
  "h-8 shrink-0 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium whitespace-nowrap text-ink hover:bg-surface-2";

export function AmmoField({ setup, resolved, onLoadChange, onChange, onShowSources }: Props) {
  const id = useId();
  const isCustom = setup.loadId === CUSTOM_LOAD_ID;
  const u = setup.units;
  const load = resolved.load;
  const measured = setup.mvOverrideFps != null || isCustom;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-load-label`} className="text-xs font-medium text-ink-2">
          Load
        </span>
        <LoadPicker id={`${id}-load`} labelId={`${id}-load-label`} value={setup.loadId} onChange={onLoadChange} />
        {load && (
          <p className="text-xs leading-relaxed text-ink-3">
            {load.group} · {load.dragModel} BC {load.bc} · {load.confidence}-confidence velocity data ·{" "}
            <button type="button" onClick={onShowSources} className="text-ink-2 underline underline-offset-2 hover:text-ink">
              sources
            </button>
          </p>
        )}
      </div>

      {isCustom && (
        <div className="grid grid-cols-3 gap-2.5">
          <NumberInput
            id={`${id}-w`}
            label="Weight"
            unit="gr"
            decimals={1}
            value={setup.customLoad.weightGr}
            limits={LIMITS.weightGr}
            onCommit={(weightGr) => onChange({ customLoad: { ...setup.customLoad, weightGr } })}
          />
          <NumberInput
            id={`${id}-bc`}
            label="BC"
            value={setup.customLoad.bc}
            limits={LIMITS.bc}
            onCommit={(bc) => onChange({ customLoad: { ...setup.customLoad, bc } })}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-2">Drag model</span>
            <div role="group" aria-label="Drag model" className="flex h-9 rounded-md border border-line-strong p-0.5">
              {(["G1", "G7"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={setup.customLoad.dragModel === m}
                  onClick={() => onChange({ customLoad: { ...setup.customLoad, dragModel: m } })}
                  className={`flex-1 rounded font-mono text-sm ${
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

      <div className="flex flex-col gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-2">Muzzle velocity</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{fmtVelocity(resolved.muzzleVelocityFps, u)}</span>
            <span className="text-[11px] text-ink-3">
              {measured
                ? isCustom
                  ? "entered for your custom load"
                  : "your chronograph value"
                : `estimated for a ${fmtBarrel(setup.barrelIn)} barrel`}
            </span>
          </div>
          {!isCustom &&
            (setup.mvOverrideFps == null ? (
              <button
                type="button"
                className={smallButton}
                onClick={() => onChange({ mvOverrideFps: Math.round(resolved.muzzleVelocityFps) })}
              >
                Enter chrono
              </button>
            ) : (
              <button type="button" className={smallButton} onClick={() => onChange({ mvOverrideFps: null })}>
                Use estimate
              </button>
            ))}
        </div>
        {resolved.mvSource === "extrapolated" && (
          <p className="text-xs text-warn-ink">
            This barrel is outside the published data for this load, so the velocity is extrapolated. A chronograph value
            is better.
          </p>
        )}
        {measured && (
          <div className="w-40">
            <NumberInput
              id={`${id}-mv`}
              label="Measured velocity"
              unit={velocityUnit(u)}
              decimals={0}
              value={velocityToDisplay(resolved.muzzleVelocityFps, u)}
              limits={[velocityToDisplay(LIMITS.mvFps[0], u), velocityToDisplay(LIMITS.mvFps[1], u)]}
              onCommit={(v) => onChange({ mvOverrideFps: velocityFromDisplay(v, u) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
