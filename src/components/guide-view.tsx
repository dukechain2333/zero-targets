import type { Guide } from "@/lib/guide";

/** The setup-specific zeroing instructions (also printed as page 2 of the PDF). */
export function GuideView({ guide }: { guide: Guide }) {
  return (
    <section id="guide" className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">{guide.title}</h2>
      <p className="mt-1 text-sm text-ink-2">{guide.subtitle}</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <ol className="space-y-5">
          {guide.steps.map((step, i) => (
            <li key={step.heading} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
              <span className="flex size-7 items-center justify-center rounded-full border border-line-strong font-mono text-sm text-ink">
                {i + 1}
              </span>
              <div>
                <h3 className="pt-0.5 font-semibold text-ink">{step.heading}</h3>
                {step.body.map((b) => (
                  <p key={b} className="mt-1 text-sm leading-relaxed text-ink-2">
                    {b}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <div className="space-y-5">
          <dl className="divide-y divide-line rounded-lg border border-line text-sm">
            {guide.facts.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-2 text-xs leading-relaxed text-ink-3">
            {guide.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
