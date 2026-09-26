import Link from "next/link";
import { loadGroups } from "@/lib/ammo";
import { ZeroApp } from "@/components/zero-app";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <circle cx="16" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M16 3v2M8 11h2M22 11h2" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="16" cy="24" r="3.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="16" cy="24" r="1" fill="var(--accent)" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Mark />
          <span className="font-mono text-lg font-semibold tracking-tight">zero-targets</span>
        </Link>
        <a href="#how-it-works" className="text-sm text-ink-2 hover:text-ink">
          How it works
        </a>
      </header>

      <div className="max-w-3xl pt-4 pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Zero at 25 yards. Hit at 50, 100 or 200.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-2 sm:text-lg">
          Enter your barrel, optic height and ammunition. zero-targets calculates where your bullet crosses the line
          of sight and prints a 1:1 target that shows exactly where the group has to land at the distance you can
          actually shoot.
        </p>
      </div>

      <ZeroApp />

      <section id="how-it-works" className="mt-10 grid gap-8 border-t border-line pt-10 lg:grid-cols-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Why the group is not on the bullseye</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Your optic sits above the bore, so the bullet starts below the line of sight and climbs through it. A rifle
            zeroed at 50 yd still hits low at 25 yd, by an amount set mostly by sight height. zero-targets computes that
            amount and puts the IMPACT mark exactly there, so a short range can give you a zero for a longer one.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">How it is calculated</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            A point-mass trajectory solver (RK4 integration with the standard G1 and G7 drag tables) runs in your
            browser. It finds the bore angle that crosses the line of sight at your zero distance and reads the bullet
            path at your target distance. It is checked against py-ballisticcalc to within 0.01 in. Muzzle velocity
            comes from published barrel-length data for each load, or from your chronograph.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">Limits</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            The result is only as good as the inputs: sight height matters most, then distance to the target. Standard
            atmosphere, no wind. Always confirm your zero at the real distance before relying on it, and follow your
            range&apos;s safety rules.
          </p>
        </div>
      </section>

      <details id="ammo-data" className="mt-10 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold text-ink select-none">Ammunition data and sources</summary>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          Muzzle velocity by barrel length comes from chronograph tests where they exist and is interpolated between
          measured lengths. Confidence says how much of each curve is measured. Lot, temperature and barrel-to-barrel
          spread is typically 50 to 100 fps, so a chronograph value always wins.
        </p>
        <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {loadGroups().map(({ group, loads }) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-ink">{group}</h3>
              <ul className="mt-2 space-y-3">
                {loads.map((l) => (
                  <li key={l.id} className="text-xs leading-relaxed text-ink-3">
                    <div className="text-sm text-ink-2">
                      {l.name}{" "}
                      <span className="text-xs text-ink-3">
                        · {l.dragModel} BC {l.bc} · {l.confidence} confidence
                      </span>
                    </div>
                    <div>{l.notes}</div>
                    <div>
                      {l.sources.map((src, i) => (
                        <span key={src.label}>
                          {i > 0 && " · "}
                          {src.url ? (
                            <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
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
            </div>
          ))}
        </div>
      </details>

      <footer className="mt-12 border-t border-line pt-6 text-xs text-ink-3">
        zero-targets computes approximate offsets for convenience. Verify your zero at distance.
      </footer>
    </div>
  );
}
