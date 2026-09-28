"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { barrelPresetsFor, defaultTableRangeYd, estimateMuzzleVelocity, getLoad } from "@/lib/ammo";
import { buildBallisticTable } from "@/lib/ballistic-table";
import { computeZero } from "@/lib/compute";
import { buildGuide } from "@/lib/guide";
import { targetHints, zeroHints } from "@/lib/hints";
import {
  RAIL_TO_BORE_PRESETS,
  snapDistance,
  TABLE_RANGE_PRESETS,
  TABLE_STEP_PRESETS,
  TARGET_DISTANCE_PRESETS,
  ZERO_PRESETS,
} from "@/lib/presets";
import { CUSTOM_LOAD_ID, DEFAULT_SETUP, resolveSetup, setupFromQuery, setupToQuery, type Setup } from "@/lib/setup";
import { buildBallisticsDoc } from "@/lib/target/ballistics-pages";
import { renderPackPdf, type PackPart } from "@/lib/target/pdf";
import { buildTargetScene, distanceLabel, unitLabel } from "@/lib/target/scene";
import { distanceToDisplay, distanceUnit, trimNumber, type UnitSystem } from "@/lib/units";
import { Desk, type DocTab, type Zoom } from "./desk";
import { ChartDialogBody } from "./chart-dialog";
import { packPageCount, PrintPack, QuickFacts, ResultHero, ResultPill, type PackInclude } from "./inspector";
import { SectionSheetBody, SetupList, SetupRail, type SectionId, type SetupContext } from "./setup-sections";
import { Sheet } from "./sheet";

const DESK_QUERY = "(min-width: 74rem)";

/** Whether the three-column workbench layout is showing (false on the server and on phones). */
function useIsDesk() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESK_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESK_QUERY).matches,
    () => false,
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M16 3v2M8 11h2M22 11h2" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="16" cy="24" r="3.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="16" cy="24" r="1.1" fill="var(--accent)" />
      </svg>
      <span className="font-mono text-[15px] font-semibold tracking-tight whitespace-nowrap desk:text-[17px]">zero-targets</span>
    </Link>
  );
}

function UnitsToggle({ value, onChange }: { value: UnitSystem; onChange: (u: UnitSystem) => void }) {
  return (
    <div role="group" aria-label="Units" className="flex gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
      {(
        [
          ["imperial", "yd", " · in", "Imperial units"],
          ["metric", "m", " · mm", "Metric units"],
        ] as const
      ).map(([v, short, rest, name]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          aria-label={name}
          onClick={() => onChange(v)}
          className={`h-[30px] rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap desk:px-3 ${
            value === v ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {short}
          <span className="hidden sm:inline">{rest}</span>
        </button>
      ))}
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Close" onClick={onClick} className="flex size-11 items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/** Switch loads, keeping a barrel length and rail height that suit the new one. */
function changeLoadIn(s: Setup, loadId: string): Setup {
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
  const presets = barrelPresetsFor(load);
  if (estimateMuzzleVelocity(load, s.barrelIn).extrapolated && !presets.some((p) => p.value === s.barrelIn)) {
    next.barrelIn = presets.find((p) => p.value === 16)?.value ?? presets[Math.floor(presets.length / 2)].value;
  }
  // Follow the platform's rail height unless the user typed their own.
  if (RAIL_TO_BORE_PRESETS.some((p) => p.value === s.railToBoreIn)) {
    next.railToBoreIn = RAIL_TO_BORE_PRESETS[load.platform === "ar10" ? 1 : 0].value;
  }
  return next;
}

/** Follow the new load's default table range unless the user picked their own. */
function withTableRange(prev: Setup, next: Setup): Setup {
  const before = resolveSetup(prev);
  if (Math.abs(prev.tableMaxYd - defaultTableRangeYd(before.load, before.muzzleVelocityFps)) > 1e-6) return next;
  const after = resolveSetup(next);
  return { ...next, tableMaxYd: defaultTableRangeYd(after.load, after.muzzleVelocityFps) };
}

function packFileName(setup: Setup, loadShort: string) {
  const u = setup.units;
  const d = (yd: number) => `${trimNumber(distanceToDisplay(yd, u), 1)}${distanceUnit(u)}`;
  const slug = loadShort.replace(/[^A-Za-z0-9.]+/g, "-").replace(/^-|-$/g, "");
  return `zero-targets_${slug}_${trimNumber(setup.barrelIn, 2)}in_${d(setup.targetYd)}-for-${d(setup.zeroYd)}-zero.pdf`;
}

type SheetId = SectionId | "print" | "about" | "chart" | null;

export function ZeroApp({ about }: { about: React.ReactNode }) {
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [include, setInclude] = useState<PackInclude>({ target: true, guide: true, cards: true, table: false });
  const [tab, setTab] = useState<DocTab>("target");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [tableView, setTableView] = useState<"page" | "data">("page");
  const [sheet, setSheet] = useState<SheetId>(null);
  const [busy, setBusy] = useState<"download" | "open" | null>(null);
  const [copied, setCopied] = useState(false);
  const loadedFromUrl = useRef(false);
  const isDesk = useIsDesk();

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
  const table = useMemo(() => buildBallisticTable(current, result), [current, result]);
  const ballistics = useMemo(
    () => buildBallisticsDoc(current, result, table, { cards: true, table: true }),
    [current, result, table],
  );
  const cardsPage = ballistics.pages.find((p) => p.label === "Cards")?.scene ?? null;
  const tablePages = ballistics.pages.filter((p) => p.label.startsWith("Table")).map((p) => p.scene);
  const hints = useMemo(
    () => ({
      zero: zeroHints(result, ZERO_PRESETS[current.units].map((p) => p.value), current.units),
      target: targetHints(result, TARGET_DISTANCE_PRESETS[current.units].map((p) => p.value), current.units),
    }),
    [result, current.units],
  );

  const u = setup.units;
  const resolved = resolveSetup(setup);
  const update = (patch: Partial<Setup>) => setSetup((s) => ({ ...s, ...patch }));
  const setUnits = (units: UnitSystem) =>
    setSetup((s) =>
      s.units === units
        ? s
        : {
            ...s,
            units,
            zeroYd: snapDistance(s.zeroYd, s.units, units, ZERO_PRESETS),
            targetYd: snapDistance(s.targetYd, s.units, units, TARGET_DISTANCE_PRESETS),
            tableMaxYd: snapDistance(s.tableMaxYd, s.units, units, TABLE_RANGE_PRESETS),
            tableStepYd: snapDistance(s.tableStepYd, s.units, units, TABLE_STEP_PRESETS),
          },
    );

  // Open the data sources at the current load: expand its caliber, scroll to it and flash it.
  const showSources = () => {
    setSheet("about");
    requestAnimationFrame(() => {
      const item = document.getElementById(`load-${setup.loadId}`);
      if (!item) return document.getElementById("ammo-data")?.scrollIntoView({ block: "start" });
      const details = item.closest("details");
      if (details) details.open = true;
      item.scrollIntoView({ block: "center" });
      item.animate([{ backgroundColor: "var(--accent-soft)" }, { backgroundColor: "transparent" }], { duration: 1600, easing: "ease-out" });
    });
  };

  const ctx: SetupContext = {
    setup,
    resolved,
    result,
    update,
    changeLoad: (loadId) => setSetup((s) => withTableRange(s, changeLoadIn(s, loadId))),
    onShowSources: showSources,
    zeroHints: hints.zero,
    targetHints: hints.target,
  };

  const pdf = async (mode: "download" | "open") => {
    const parts: PackPart[] = [];
    if (include.target) parts.push({ kind: "page", scene });
    if (include.guide) parts.push({ kind: "guide", guide });
    if (include.cards && cardsPage) parts.push({ kind: "page", scene: cardsPage });
    if (include.table) for (const p of tablePages) parts.push({ kind: "page", scene: p });
    if (parts.length === 0) return;
    // Open the tab synchronously so popup blockers treat it as user-initiated.
    const win = mode === "open" ? window.open("", "_blank") : null;
    setBusy(mode);
    try {
      const doc = await renderPackPdf(parts, result.resolved.paper, `${scene.title}: ${result.resolved.loadShort}`);
      if (mode === "download") doc.save(packFileName(current, result.resolved.loadShort));
      else if (win) win.location.href = String(doc.output("bloburl"));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const pages = packPageCount(include, tablePages.length);
  const packProps = {
    setup,
    update,
    include,
    onInclude: setInclude,
    tablePageCount: tablePages.length,
    targetFits: scene.fits,
    busy,
    onDownload: () => pdf("download"),
    onOpen: () => pdf("open"),
  };
  const [near, far] = result.crossingsYd;
  const other = far ?? near;
  const angle = Math.abs(scene.grid.unit === "moa" ? result.offsetMoa : result.offsetMil);
  const sectionSheet = sheet === "ammo" || sheet === "rifle" || sheet === "zero" ? sheet : null;

  return (
    <div className="flex min-h-dvh flex-col pb-24 desk:h-dvh desk:overflow-hidden desk:pb-0">
      <h1 className="sr-only">zero-targets: printable zeroing targets, ballistic cards and ballistic tables</h1>

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 desk:gap-5 desk:px-5">
        <Logo />
        <span className="hidden text-[13px] text-ink-3 desk:inline">Printable zeroing targets and ballistic cards</span>
        <div className="grow" />
        <UnitsToggle value={u} onChange={setUnits} />
        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy link to this setup"}
          className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2 desk:px-3.5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
          </svg>
          <span className="hidden desk:inline">{copied ? "Copied" : "Copy link"}</span>
        </button>
        <button
          type="button"
          onClick={() => setSheet("about")}
          aria-label="How it works"
          className="flex h-9 items-center rounded-lg px-2 text-[13px] text-ink-2 hover:text-ink"
        >
          <span className="hidden desk:inline">How it works</span>
          <svg className="desk:hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17h.01" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 grow flex-col desk:grid desk:grid-cols-[clamp(380px,25vw,560px)_minmax(0,1fr)_clamp(340px,21vw,480px)]">
        {/* Desktop: setup rail. The scrolling side columns are positioned so that absolutely positioned
            children (sr-only labels) scroll inside them instead of stretching the page, which would let
            the whole page scroll under the desk. */}
        <aside aria-label="Setup" className="relative hidden overflow-y-auto border-r border-line px-4 py-[18px] desk:block">
          <SetupRail ctx={ctx} />
        </aside>

        {/* Phone: the answer first */}
        <div className="flex items-end justify-between gap-3 border-b border-line px-4 pt-2 pb-3.5 desk:hidden">
          <ResultHero setup={current} result={result} unit={scene.grid.unit} size="md" detail={false} />
          <div className="flex shrink-0 flex-col items-end gap-0.5 pb-1 font-mono text-xs text-ink-2">
            <span>
              {angle.toFixed(1)} {unitLabel(scene.grid.unit)}
            </span>
            <span>{distanceLabel(current.zeroYd, u)} zero</span>
            {other != null && Math.abs(other - current.zeroYd) > 1 && (
              <span>
                on again {Math.round(distanceToDisplay(other, u))} {distanceUnit(u)}
              </span>
            )}
          </div>
        </div>

        <main className="flex flex-col bg-desk desk:min-h-0">
          <Desk
            tab={tab}
            onTab={setTab}
            zoom={zoom}
            onZoom={setZoom}
            tableView={tableView}
            onTableView={setTableView}
            constrained={isDesk}
            paperLabel={result.resolved.paper.label}
            scene={scene}
            guide={guide}
            cards={cardsPage}
            tablePages={tablePages}
            setup={current}
            update={update}
            result={result}
            table={table}
          />
        </main>

        {/* Desktop: inspector */}
        <aside
          aria-label="Result and print"
          className="relative hidden flex-col gap-[18px] overflow-y-auto border-l border-line bg-surface p-5 desk:flex"
        >
          <ResultHero setup={current} result={result} unit={scene.grid.unit} />
          <QuickFacts setup={current} result={result} table={table} tab={tab} onExpandChart={() => setSheet("chart")} />
          <section aria-label="Print pack" className="mt-auto flex flex-col gap-3 rounded-xl border border-line bg-ground p-4">
            <h2 className="eyebrow">Print pack</h2>
            <PrintPack {...packProps} />
          </section>
        </aside>

        {/* Phone: setup rows and the path chart below the preview */}
        <div className="bg-desk desk:hidden">
          <SetupList ctx={ctx} onOpen={setSheet} />
          <div className="bg-surface px-4 pt-2 pb-6">
            <QuickFacts setup={current} result={result} table={table} tab="target" onExpandChart={() => setSheet("chart")} />
          </div>
        </div>
      </div>

      {/* Phone: actions always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] desk:hidden">
        <button
          type="button"
          onClick={() => pdf("download")}
          disabled={pages === 0 || (include.target && !scene.fits) || busy != null}
          className="flex h-[52px] grow items-center justify-center gap-2.5 rounded-[10px] bg-primary text-[15px] font-semibold text-primary-ink disabled:opacity-50"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          {busy === "download" ? "Preparing…" : `Download · ${pages} page${pages === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={() => setSheet("print")}
          className="h-[52px] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink"
        >
          Print pack
        </button>
      </div>

      <Sheet open={sectionSheet != null} onClose={() => setSheet(null)} label="Edit setup" className="overflow-y-auto">
        {sectionSheet && (
          <SectionSheetBody
            ctx={ctx}
            id={sectionSheet}
            onDone={() => setSheet(null)}
            result={<ResultPill setup={current} result={result} unit={scene.grid.unit} />}
          />
        )}
      </Sheet>

      <Sheet open={sheet === "print"} onClose={() => setSheet(null)} label="Print pack" className="overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pt-3 pb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[30px] leading-none font-bold">Print pack</h2>
            <CloseButton onClick={() => setSheet(null)} />
          </div>
          <PrintPack {...packProps} withTableSettings roomy />
        </div>
      </Sheet>

      <Sheet
        open={sheet === "chart"}
        onClose={() => setSheet(null)}
        label="Bullet path"
        placement={isDesk ? "center" : "bottom"}
        wide
        className="overflow-y-auto"
      >
        {sheet === "chart" && (
          <ChartDialogBody setup={current} result={result} onClose={() => setSheet(null)} chartHeight={isDesk ? 460 : 300} />
        )}
      </Sheet>

      <Sheet
        open={sheet === "about"}
        onClose={() => setSheet(null)}
        label="How it works"
        placement={isDesk ? "center" : "bottom"}
        className="overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface py-2 pr-2 pl-5">
          <h2 className="font-display text-2xl font-bold">How it works</h2>
          <CloseButton onClick={() => setSheet(null)} />
        </div>
        <div className="px-5 pt-4 pb-8">{about}</div>
      </Sheet>
    </div>
  );
}
