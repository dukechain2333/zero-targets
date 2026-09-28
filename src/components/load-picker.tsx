"use client";

import { useEffect, useRef, useState } from "react";
import { followersOf, getLoad, searchLoads, standardName, type Load, type LoadView } from "@/lib/ammo";
import { CUSTOM_LOAD_ID } from "@/lib/setup";

interface Props {
  id: string;
  labelId: string;
  value: string;
  onChange: (loadId: string) => void;
}

const CUSTOM_NAME = "Custom load (enter bullet data)";

const VIEWS: { id: LoadView; label: string; placeholder: string }[] = [
  { id: "standard", label: "Standard", placeholder: "Search: M855, 77 gr, subsonic…" },
  { id: "brand", label: "Brand", placeholder: "Search: brand, caliber, weight, box code…" },
];

type Row =
  | { kind: "group"; label: string }
  | { kind: "option"; id: string; name: string; sku?: string; detail?: string; index: number };

const productLabel = (l: Load) => [l.brand, l.sku?.[0]].filter(Boolean).join(" ");

// Standard view, second line: the factory loads made to this type, or the product a type's data comes from.
function standardDetail(l: Load): string | undefined {
  if (l.brand) return productLabel(l);
  const makers = followersOf(l.id).map(productLabel);
  if (!makers.length) return undefined;
  return makers.length > 3 ? `${makers.slice(0, 3).join(" · ")} · +${makers.length - 3} more` : makers.join(" · ");
}

// The view that shows the current load: generic loads live in Standard, most factory loads in Brand.
function viewFor(load: Load | undefined, current: LoadView): LoadView {
  if (!load) return current;
  if (!load.brand) return "standard";
  return load.standard != null ? current : "brand";
}

/** Load select with two views (standard types or factory loads by brand) and a search box. */
export function LoadPicker({ id, labelId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<LoadView>("standard");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focusSearch, setFocusSearch] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef(false);
  const listId = `${id}-list`;
  const optionId = (loadId: string) => `${id}-opt-${loadId}`;
  const load = getLoad(value);

  const matches = { standard: searchLoads(query, "standard"), brand: searchLoads(query, "brand") };
  const results = matches[view];
  const other: LoadView = view === "standard" ? "brand" : "standard";
  const optionIds = [...results.map((l) => l.id), CUSTOM_LOAD_ID];
  const rows: Row[] = [];
  results.forEach((l, index) => {
    if (index === 0 || results[index - 1].group !== l.group) rows.push({ kind: "group", label: l.group });
    rows.push(
      view === "standard"
        ? { kind: "option", id: l.id, name: standardName(l), detail: standardDetail(l), index }
        : { kind: "option", id: l.id, name: l.name, sku: l.sku?.[0], index },
    );
  });
  rows.push({ kind: "group", label: "Other" });
  rows.push({ kind: "option", id: CUSTOM_LOAD_ID, name: CUSTOM_NAME, index: results.length });
  const activeId = optionIds[Math.min(active, optionIds.length - 1)];

  // Highlight the current load if the list shows it, else the first match.
  const startIndex = (list: Load[], q: string) =>
    q ? 0 : value === CUSTOM_LOAD_ID ? list.length : Math.max(0, list.findIndex((l) => l.id === value));

  const show = (initialQuery = "", focusSearch = true) => {
    const v = viewFor(load, view);
    setView(v);
    setQuery(initialQuery);
    setActive(startIndex(searchLoads(initialQuery, v), initialQuery));
    // Touch users mostly scroll and tap; opening the keyboard would cover the list.
    setFocusSearch(focusSearch);
    setOpen(true);
  };
  const hide = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (loadId: string) => {
    if (loadId !== value) onChange(loadId);
    hide(true);
  };
  const switchView = (v: LoadView) => {
    setView(v);
    setActive(startIndex(matches[v], query));
  };

  // Close on a click or tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // In a phone sheet the list opens near the bottom: scroll the sheet so the whole panel shows.
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId, id]);

  const current = value === CUSTOM_LOAD_ID ? CUSTOM_NAME : (load?.name ?? "Choose a load");

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        // Keep Escape from also closing a sheet the picker sits in.
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          hide(true);
        }
      }}
      // Close when keyboard focus moves on past the picker.
      onBlur={(e) => {
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}`}
        onPointerDown={(e) => {
          touchRef.current = e.pointerType === "touch";
        }}
        onClick={() => {
          if (open) hide(false);
          else show("", !touchRef.current);
          touchRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          } else if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
            // Start typing on the closed picker to search.
            e.preventDefault();
            show(e.key);
          }
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-left text-sm text-ink hover:bg-surface-2"
      >
        <span className="truncate">{current}</span>
        <svg aria-hidden viewBox="0 0 16 16" className={`size-4 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute inset-x-0 top-full z-30 mt-1 flex flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[0_10px_28px_rgb(0_0_0/0.22)]"
        >
          <div role="group" aria-label="List loads by" className="flex gap-1 border-b border-line p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                // Keep focus (and the keyboard, on phones) in the search box.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => switchView(v.id)}
                className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium ${
                  view === v.id ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {v.label}
                <span className="font-mono text-[11px] font-normal tabular-nums text-ink-3">{matches[v.id].length}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-b border-line px-2.5 focus-within:border-series">
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-3">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth={1.5} />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              // Focus as soon as it mounts, so keys typed right after opening land here.
              autoFocus={focusSearch}
              type="search"
              role="combobox"
              aria-label="Search loads"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={optionId(activeId)}
              autoComplete="off"
              spellCheck={false}
              placeholder={VIEWS.find((v) => v.id === view)!.placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const n = optionIds.length;
                  setActive((a) => (Math.min(a, n - 1) + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  pick(activeId);
                }
              }}
              className="h-10 min-w-0 grow bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setActive(0);
                  inputRef.current?.focus();
                }}
                className="grid size-6 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          <ul id={listId} role="listbox" aria-label="Loads" className="max-h-[min(22rem,55dvh)] overflow-y-auto py-1">
            {results.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-xs text-ink-3">
                {matches[other].length > 0 ? (
                  <>
                    No {view} load matches “{query.trim()}”.{" "}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => switchView(other)}
                      className="text-ink-2 underline underline-offset-2 hover:text-ink"
                    >
                      Show {matches[other].length} in {VIEWS.find((v) => v.id === other)!.label}
                    </button>
                  </>
                ) : (
                  <>No load matches “{query.trim()}”. Pick a custom load and enter your bullet&apos;s data.</>
                )}
              </li>
            )}
            {rows.map((row) =>
              row.kind === "group" ? (
                <li
                  key={`g-${row.label}`}
                  role="presentation"
                  className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase"
                >
                  {row.label}
                </li>
              ) : (
                <li
                  key={row.id}
                  id={optionId(row.id)}
                  role="option"
                  aria-selected={row.id === value}
                  onPointerMove={() => setActive(row.index)}
                  // Keep focus in the search box while clicking.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row.id)}
                  className={`mx-1 flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                    row.id === activeId ? "bg-surface-2 text-ink" : "text-ink-2"
                  }`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span>{row.name}</span>
                    {row.detail && <span className="truncate text-[11px] text-ink-3">{row.detail}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {row.sku && <span className="font-mono text-[11px] text-ink-3">{row.sku}</span>}
                    {row.id === value && (
                      <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-accent">
                        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
