"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { barrelPresetsFor, estimateMuzzleVelocity, getLoad } from "@/lib/ammo";
import { sampleTrajectory } from "@/lib/ballistics/solver";
import { computeZero } from "@/lib/compute";
import { buildGuide } from "@/lib/guide";
import {
  CLICK_PRESETS,
  OPTIC_HEIGHT_PRESETS,
  PAPER_SIZES,
  RAIL_TO_BORE_PRESETS,
  snapDistance,
  TARGET_DISTANCE_PRESETS,
  ZERO_PRESETS,
} from "@/lib/presets";
import { CUSTOM_LOAD_ID, DEFAULT_SETUP, LIMITS, resolveSetup, setupFromQuery, setupToQuery, type Setup } from "@/lib/setup";
import { renderTargetPdf } from "@/lib/target/pdf";
import { buildTargetScene, distanceLabel, unitLabel } from "@/lib/target/scene";
import {
  distanceFromDisplay,
  distanceToDisplay,
  distanceUnit,
  fmtOffset,
  fmtPath,
  fmtSightHeight,
  fmtVelocity,
  heightFromDisplay,
  heightToDisplay,
  heightUnit,
  MM_PER_IN,
  type UnitSystem,
} from "@/lib/units";
import { AmmoField } from "./ammo-field";
import { ChoiceField } from "./choice-field";
import { GuideView } from "./guide-view";
import { TargetPreview } from "./target-preview";
import { TrajectoryChart } from "./trajectory-chart";

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary font-mono text-xs text-primary-ink">
          {step}
        </span>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-md px-3 text-sm ${
            value === o.value ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-ink">{value}</div>
      {note && <div className="text-[11px] text-ink-3">{note}</div>}
    </div>
  );
}

export function ZeroApp() {
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [includeGuide, setIncludeGuide] = useState(true);
  const [busy, setBusy] = useState<"download" | "open" | null>(null);
  const [copied, setCopied] = useState(false);
  const loadedFromUrl = useRef(false);

  // Restore a shared setup from the URL once, then mirror every change back into it.
  useEffect(() => {
    if (!loadedFromUrl.current) {
      loadedFromUrl.current = true;
      if (window.location.search) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL after hydration
        setSetup(setupFromQuery(window.location.search));
      }
      return;
    }
    const q = setupToQuery(setup);
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [setup]);

  const current = useDeferredValue(setup);
  const result = useMemo(() => computeZero(current), [current]);
  const scene = useMemo(() => buildTargetScene(current, result), [current, result]);
  const guide = useMemo(() => buildGuide(current, result, scene.grid), [current, result, scene.grid]);

  const update = (patch: Partial<Setup>) => setSetup((s) => ({ ...s, ...patch }));
  const u = setup.units;
  const resolved = resolveSetup(setup);

  const setUnits = (units: UnitSystem) =>
    setSetup((s) =>
      s.units === units
        ? s
        : {
            ...s,
            units,
            zeroYd: snapDistance(s.zeroYd, s.units, units, ZERO_PRESETS),
            targetYd: snapDistance(s.targetYd, s.units, units, TARGET_DISTANCE_PRESETS),
          },
    );

  const changeLoad = (loadId: string) =>
    setSetup((s) => {
      if (loadId === CUSTOM_LOAD_ID) {
        const r = resolveSetup(s);
        return {
          ...s,
          loadId,
          mvOverrideFps: Math.round(r.muzzleVelocityFps),
          customLoad: r.load ? { weightGr: r.load.weightGr, bc: r.load.bc, dragModel: r.load.dragModel } : s.customLoad,
        };
      }
      const load = getLoad(loadId);
      if (!load) return s;
      const next: Setup = { ...s, loadId, mvOverrideFps: null };
      // Keep a barrel length that makes sense for the new caliber.
      const presets = barrelPresetsFor(load);
      if (estimateMuzzleVelocity(load, s.barrelIn).extrapolated && !presets.some((p) => p.value === s.barrelIn)) {
        next.barrelIn = presets.find((p) => p.value === 16)?.value ?? presets[Math.floor(presets.length / 2)].value;
      }
      // Follow the platform's rail height unless the user typed their own.
      if (RAIL_TO_BORE_PRESETS.some((p) => p.value === s.railToBoreIn)) {
        next.railToBoreIn = RAIL_TO_BORE_PRESETS[load.platform === "ar10" ? 1 : 0].value;
      }
      return next;
    });

  const pdf = async (mode: "download" | "open") => {
    // Open the tab synchronously so popup blockers treat it as user-initiated.
    const tab = mode === "open" ? window.open("", "_blank") : null;
    setBusy(mode);
    try {
      const doc = await renderTargetPdf(scene, includeGuide ? guide : null);
      if (mode === "download") doc.save(scene.fileName);
      else if (tab) tab.location.href = String(doc.output("bloburl"));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const dist = Math.abs(result.offsetIn);
  const where = dist < 0.005 ? "on" : result.offsetIn < 0 ? "low" : "high";
  const angle = Math.abs(scene.grid.unit === "moa" ? result.offsetMoa : result.offsetMil);
  const [near, far] = result.crossingsYd;
  const distDisplay = {
    toDisplay: (yd: number) => distanceToDisplay(yd, u),
    fromDisplay: (v: number) => distanceFromDisplay(v, u),
  };
  const heightDisplay = {
    toDisplay: (inch: number) => heightToDisplay(inch, u),
    fromDisplay: (v: number) => heightFromDisplay(v, u),
  };
  const load = resolved.load;
  const barrelPresets = barrelPresetsFor(load);

  return (
    <div className="space-y-10">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ------------------------------------------------ inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-2">Units</span>
            <Segmented
              label="Units"
              value={u}
              onChange={setUnits}
              options={[
                { value: "imperial", label: "Imperial (yd, in)" },
                { value: "metric", label: "Metric (m, mm)" },
              ]}
            />
          </div>

          <Section step={1} title="Ammunition">
            <AmmoField setup={setup} resolved={resolved} onLoadChange={changeLoad} onChange={update} />
          </Section>

          <Section step={2} title="Rifle and optic">
            <ChoiceField
              label="Barrel length"
              description="Sets the estimated velocity"
              presets={barrelPresets}
              value={setup.barrelIn}
              onChange={(barrelIn) => update({ barrelIn })}
              unit="in"
              limits={LIMITS.barrelIn}
              note={u === "metric" ? `${(setup.barrelIn * MM_PER_IN).toFixed(0)} mm` : undefined}
            />
            <ChoiceField
              label="Optic height (riser)"
              description="Rail top to optic center"
              presets={OPTIC_HEIGHT_PRESETS}
              value={setup.opticHeightIn}
              onChange={(opticHeightIn) => update({ opticHeightIn })}
              unit={heightUnit(u)}
              limits={LIMITS.opticHeightIn}
              decimals={u === "metric" ? 1 : 3}
              {...heightDisplay}
            />
            <details className="group rounded-md border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm text-ink-2 select-none">
                Rail to bore: <span className="font-mono text-ink">{fmtSightHeight(setup.railToBoreIn, u)}</span>
                <span className="text-ink-3"> · sight height {fmtSightHeight(resolved.sightHeightIn, u)}</span>
              </summary>
              <div className="pt-3">
                <ChoiceField
                  label="Bore centerline to rail top"
                  presets={RAIL_TO_BORE_PRESETS}
                  value={setup.railToBoreIn}
                  onChange={(railToBoreIn) => update({ railToBoreIn })}
                  unit={heightUnit(u)}
                  limits={LIMITS.railToBoreIn}
                  decimals={u === "metric" ? 1 : 3}
                  {...heightDisplay}
                />
                <p className="mt-2 text-xs text-ink-3">
                  Sight height = optic height + rail to bore. For a non-AR rifle, measure from the center of the bore
                  to the center of the optic and enter the difference to the rail here.
                </p>
              </div>
            </details>
          </Section>

          <Section step={3} title="Distances">
            <ChoiceField
              label="Zero distance you want"
              presets={ZERO_PRESETS[u]}
              value={setup.zeroYd}
              onChange={(zeroYd) => update({ zeroYd })}
              unit={distanceUnit(u)}
              limits={LIMITS.zeroYd}
              decimals={1}
              {...distDisplay}
            />
            <ChoiceField
              label="Distance you will shoot at"
              description="Where the target hangs"
              presets={TARGET_DISTANCE_PRESETS[u]}
              value={setup.targetYd}
              onChange={(targetYd) => update({ targetYd })}
              unit={distanceUnit(u)}
              limits={LIMITS.targetYd}
              decimals={1}
              {...distDisplay}
            />
          </Section>

          <Section step={4} title="Printout">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-ink">Turret click value</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Turret click value">
                {CLICK_PRESETS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={setup.clickId === c.id}
                    onClick={() => update({ clickId: c.id })}
                    className={`h-9 rounded-md border px-2.5 font-mono text-sm ${
                      setup.clickId === c.id
                        ? "border-primary bg-primary text-primary-ink"
                        : "border-line bg-surface text-ink hover:border-line-strong"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-2">
                The grid is drawn in {unitLabel(scene.grid.unit)}. Most red dots are 1/2 MOA per click.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label htmlFor="paper" className="block text-sm font-semibold text-ink">
                  Paper
                </label>
                <select
                  id="paper"
                  value={setup.paperId}
                  onChange={(e) => update({ paperId: e.target.value })}
                  className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink"
                >
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={includeGuide}
                  onChange={(e) => setIncludeGuide(e.target.checked)}
                  className="size-4 accent-[var(--ink)]"
                />
                Add a guide page to the PDF
              </label>
            </div>
          </Section>
        </div>

        {/* ------------------------------------------------ results */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-live="polite">
            <p className="text-sm text-ink-2">
              At {distanceLabel(setup.targetYd, u)}, for a {distanceLabel(setup.zeroYd, u)} zero, your group should hit
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {where === "on" ? (
                "on the aim point"
              ) : (
                <>
                  {fmtOffset(dist, u)} <span className="text-accent">{where}</span>
                </>
              )}
            </p>
            {where !== "on" && (
              <p className="mt-1 text-sm text-ink-2">
                {angle.toFixed(1)} {unitLabel(scene.grid.unit)} {where === "low" ? "below" : "above"} the point of aim
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Sight height" value={fmtSightHeight(resolved.sightHeightIn, u)} note="over bore" />
              <Stat
                label="Muzzle velocity"
                value={fmtVelocity(result.resolved.muzzleVelocityFps, u)}
                note={result.resolved.mvSource === "measured" ? "measured" : "estimated"}
              />
              <Stat
                label="Crosses sight line"
                value={near != null ? [near, far].filter((d) => d != null).map((d) => roundDistance(d, u)).join(" · ") : "–"}
                note="near · far zero"
              />
              <Stat
                label="Peak height"
                value={result.apex ? `+${fmtOffset(result.apex.heightIn, u)}` : "–"}
                note={result.apex ? `at ${roundDistance(result.apex.rangeYd, u)}` : undefined}
              />
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Your target</h2>
              <span className="text-xs text-ink-3">
                {resolved.paper.label} · prints at 1:1
              </span>
            </div>
            <div className="mx-auto max-w-[34rem] rounded-sm bg-white" style={{ boxShadow: "var(--paper-shadow)" }}>
              <TargetPreview scene={scene} className="block h-auto w-full" />
            </div>
            {!scene.fits && (
              <p className="mt-3 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-ink">
                AIM and IMPACT are {fmtOffset(dist, u)} apart and do not both fit on {resolved.paper.label} paper. Pick a
                larger paper size or a target distance closer to your zero distance.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => pdf("download")}
                disabled={!scene.fits || busy != null}
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink disabled:opacity-50"
              >
                {busy === "download" ? "Preparing…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => pdf("open")}
                disabled={!scene.fits || busy != null}
                className="h-10 rounded-md border border-line-strong px-4 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
              >
                {busy === "open" ? "Preparing…" : "Open PDF to print"}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="h-10 rounded-md px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                {copied ? "Link copied" : "Copy link to this setup"}
              </button>
            </div>
          </section>
        </div>
      </div>

      <GuideView guide={guide} />

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Bullet path</h2>
        <p className="mt-1 text-sm text-ink-2">
          Height of the bullet relative to your line of sight with this zero. Hover or use the arrow keys to read values.
        </p>
        <div className="mt-4">
          <TrajectoryChart result={result} units={u} targetYd={setup.targetYd} zeroYd={setup.zeroYd} />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-ink-2 select-none">Show as a table</summary>
          <TrajectoryTable result={result} units={u} />
        </details>
      </section>
    </div>
  );
}

function roundDistance(yd: number, u: UnitSystem) {
  return `${Math.round(distanceToDisplay(yd, u))} ${distanceUnit(u)}`;
}

function TrajectoryTable({ result, units }: { result: ReturnType<typeof computeZero>; units: UnitSystem }) {
  // Rows at round numbers in the display unit (every 10 or 25 yd / m).
  const maxDisplay = distanceToDisplay(result.chartMaxYd, units);
  const every = maxDisplay <= 150 ? 10 : 25;
  const ranges: number[] = [];
  for (let d = 0; d <= maxDisplay + 1e-9; d += every) ranges.push(distanceFromDisplay(d, units));
  const rows = sampleTrajectory(result.input, result.elevationRad, ranges);
  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-md border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-ink-2">
          <tr>
            <th className="px-3 py-2 font-medium">Range ({distanceUnit(units)})</th>
            <th className="px-3 py-2 font-medium">Bullet vs. sight line</th>
            <th className="px-3 py-2 font-medium">Velocity</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((p) => (
            <tr key={p.rangeYd} className="border-t border-line">
              <td className="px-3 py-1.5">{Math.round(distanceToDisplay(p.rangeYd, units) * 10) / 10}</td>
              <td className="px-3 py-1.5">
                {p.heightIn > 0 ? "+" : ""}
                {fmtPath(p.heightIn, units)}
              </td>
              <td className="px-3 py-1.5">{fmtVelocity(p.velocityFps, units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
