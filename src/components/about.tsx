import { loadGroups } from "@/lib/ammo";

/** "How it works" and the ammunition data sources, shown in a dialog. Rendered on the server. */
export function About() {
  return (
    <div className="flex flex-col gap-8 text-sm leading-relaxed text-ink-2">
      <section className="grid gap-6 sm:grid-cols-3">
        <div>
          <h3 className="font-semibold text-ink">Why the group is not on the bullseye</h3>
          <p className="mt-1.5">
            Your optic sits above the bore, so the bullet starts below the line of sight and climbs through it. A rifle
            zeroed at 50 yd still hits low at 25 yd, by an amount set mostly by sight height. zero-targets computes that
            amount and puts the IMPACT mark exactly there, so a short range can give you a zero for a longer one.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">How it is calculated</h3>
          <p className="mt-1.5">
            A point-mass trajectory solver (RK4 with the standard G1 and G7 drag tables) runs in your browser. It finds
            the bore angle that crosses the line of sight at your zero distance, then reads the bullet path, velocity and
            energy at every range, plus drift in a 10 mph crosswind for the ballistic cards and table. Zeroing assumes
            still air on level ground in a standard atmosphere. It is checked against py-ballisticcalc. Muzzle velocity
            comes from published barrel-length data, or from your chronograph.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Limits</h3>
          <p className="mt-1.5">
            The result is only as good as the inputs. For the zero target, sight height matters most; for long-range
            data, muzzle velocity and BC do. Spin drift, Coriolis and uphill or downhill shots are not modeled. Confirm
            your zero and your drops at real distances, and follow your range&apos;s safety rules.
          </p>
        </div>
      </section>

      <section id="ammo-data" className="scroll-mt-4">
        <h3 className="font-semibold text-ink">Ammunition data and sources</h3>
        <p className="mt-1.5 max-w-3xl">
          Muzzle velocity by barrel length comes from chronograph tests where they exist and is interpolated between
          measured lengths. Confidence says how much of each curve is measured: high means the load itself was tested
          across barrel lengths; medium means it was measured at a couple of lengths and a similar load&apos;s measured
          curve fills in the rest; low means one reading or only the maker&apos;s rating, which often runs fast. Lot,
          temperature and barrel-to-barrel spread is typically 50 to 100 fps, so a chronograph value always wins.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {loadGroups().map(({ group, loads }) => (
            <details key={group} className="group rounded-lg border border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="text-[13px] font-semibold text-ink">
                  {group} <span className="font-normal text-ink-3">· {loads.length} loads</span>
                </span>
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180">
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <ul className="grid gap-x-8 gap-y-3 border-t border-line px-3 py-3 md:grid-cols-2">
                {loads.map((l) => (
                  <li key={l.id} id={`load-${l.id}`} className="scroll-mt-4 rounded-md text-xs text-ink-3">
                    <div className="text-[13px] text-ink-2">
                      {l.name}{" "}
                      <span className="text-xs text-ink-3">
                        {l.sku?.length ? `· ${l.sku.join(", ")} ` : ""}· {l.weightGr} gr · {l.dragModel} BC {l.bc} ·{" "}
                        {l.confidence} confidence
                      </span>
                    </div>
                    <div>{l.notes}</div>
                    <div>
                      {l.sources.map((src, i) => (
                        <span key={src.label}>
                          {i > 0 && " · "}
                          {src.url ? (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-line-strong underline-offset-2 hover:text-ink"
                            >
                              {src.label}
                            </a>
                          ) : (
                            src.label
                          )}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
