import { TABLE_WIND_MPH, type BallisticTable } from "@/lib/ballistic-table";
import type { ZeroResult } from "@/lib/compute";
import type { Setup } from "@/lib/setup";
import { tableColumns } from "@/lib/target/ballistics-pages";
import { distanceLabel } from "@/lib/target/scene";
import { fmtWind } from "@/lib/units";

/** The detailed ballistic table on the page, same rows and columns as the PDF. */
export function BallisticTableView({ setup, result, table }: { setup: Setup; result: ZeroResult; table: BallisticTable }) {
  const columns = tableColumns(setup, result, table);
  const u = setup.units;
  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">Ballistic table</h2>
      <p className="mt-1 text-sm text-ink-2">
        {distanceLabel(setup.zeroYd, u)} zero · standard air · wind {fmtWind(TABLE_WIND_MPH, u)} full value. Path is the bullet relative to your line of sight; elevation and clicks are
        the correction (+ / U = dial or hold up); wind is how far to correct into the wind.
        {table.subsonicYd != null && ` Gray rows are subsonic (from about ${distanceLabel(table.subsonicYd, u)}).`}
      </p>
      <div className="mt-4 max-h-[32rem] overflow-auto rounded-md border border-line">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="sticky top-0 bg-surface-2 text-xs text-ink-2">
            <tr>
              {columns.map((c) => (
                <th key={c.label} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {c.label}
                  <span className="block font-normal text-ink-3">{c.sub}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {table.rows.map((r) => {
              const isZero = Math.abs(r.rangeYd - setup.zeroYd) < 0.01;
              return (
                <tr
                  key={r.rangeYd}
                  className={`border-t border-line ${r.subsonic ? "text-ink-3" : "text-ink"} ${isZero ? "bg-accent-soft font-semibold" : ""}`}
                >
                  {columns.map((c, i) => (
                    <td key={c.label} className={`px-3 py-1.5 text-right whitespace-nowrap ${i === 0 ? "font-semibold" : ""}`}>
                      {c.value(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
