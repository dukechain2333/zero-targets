import type { Guide } from "@/lib/guide";

/** The zeroing guide drawn as a sheet of paper (always light, like the printed page). */
export function GuidePage({ guide, width }: { guide: Guide; width: number }) {
  return (
    <article
      style={{ width, boxShadow: "var(--paper-shadow)" }}
      className="bg-white px-[6%] py-[5%] text-[#17160f] [color-scheme:light]"
      aria-label="Zeroing guide"
    >
      <h2 className="font-display text-3xl leading-tight font-bold">{guide.title}</h2>
      <p className="mt-1 text-sm text-[#4e4b42]">{guide.subtitle}</p>

      <dl className="mt-5 divide-y divide-[#e4e0d5] border-y border-[#b8b3a6] text-[13px]">
        {guide.facts.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3 py-1.5">
            <dt className="text-[#6b675c]">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <ol className="mt-6 flex flex-col gap-4">
        {guide.steps.map((step, i) => (
          <li key={step.heading} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#17160f] font-mono text-xs text-white">
              {i + 1}
            </span>
            <div>
              <h3 className="text-[15px] font-semibold">{step.heading}</h3>
              {step.body.map((b) => (
                <p key={b} className="mt-1 text-[13px] leading-relaxed text-[#35332c]">
                  {b}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-[#e4e0d5] pt-3">
        <h3 className="text-xs font-semibold tracking-wide text-[#6b675c] uppercase">Notes</h3>
        <ul className="mt-1.5 flex flex-col gap-1.5 text-xs leading-relaxed text-[#4e4b42]">
          {guide.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
