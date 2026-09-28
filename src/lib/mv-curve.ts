/** (barrel length in, muzzle velocity fps) points, ascending by length. */
export type MvCurve = ReadonlyArray<readonly [number, number]>;

export interface MvEstimate {
  fps: number;
  /** True when the barrel is shorter or longer than the published data covers. */
  extrapolated: boolean;
}

/**
 * Muzzle velocity for a barrel length: linear interpolation between published points. Outside the
 * data the end segment's slope is extended, which is a fair guess for a couple of inches but no more.
 */
export function estimateMuzzleVelocity(load: { mvByBarrel: MvCurve }, barrelIn: number): MvEstimate {
  const pts = load.mvByBarrel;
  if (pts.length === 1) return { fps: pts[0][1], extrapolated: barrelIn !== pts[0][0] };
  let i = pts.findIndex(([len]) => len >= barrelIn);
  const extrapolated = i === -1 || (i === 0 && barrelIn < pts[0][0]);
  if (i === -1) i = pts.length - 1;
  if (i === 0) i = 1;
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  const fps = y0 + ((barrelIn - x0) * (y1 - y0)) / (x1 - x0);
  // Steep short-barrel slopes can run away when extended; never drop below 60% of the data.
  return { fps: Math.max(fps, 0.6 * pts[0][1]), extrapolated };
}

// Velocity on a measured curve; past either end, the slope over the last few inches is extended
// (one noisy inch at the end would otherwise skew a long extrapolation).
function curveAt(shape: MvCurve, barrelIn: number): number {
  const first = shape[0];
  const last = shape[shape.length - 1];
  if (barrelIn >= first[0] && barrelIn <= last[0]) return estimateMuzzleVelocity({ mvByBarrel: shape }, barrelIn).fps;
  const [a, b] =
    barrelIn > last[0]
      ? [shape.findLast(([len]) => len <= last[0] - 4) ?? first, last]
      : [first, shape.find(([len]) => len >= first[0] + 4) ?? last];
  return b[1] + ((barrelIn - b[0]) * (b[1] - a[1])) / (b[0] - a[0]);
}

const round5 = (v: number) => Math.round(v / 5) * 5;

/**
 * A curve for a load measured at only a few barrel lengths, often in different rifles, or known only
 * from the maker's spec: the measured curve of a similar load, scaled by the median ratio of the
 * known points to it. Known points beyond the ends of the shape (e.g. a 24 in factory test barrel)
 * extend the curve to cover them.
 */
export function fitCurve(shape: MvCurve, points: MvCurve): [number, number][] {
  const ratios = points.map(([len, fps]) => fps / curveAt(shape, len)).sort((a, b) => a - b);
  const mid = ratios.length >> 1;
  const k = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  const lengths = new Set(shape.map(([len]) => len));
  for (const [len] of points) if (len < shape[0][0] || len > shape[shape.length - 1][0]) lengths.add(len);
  return [...lengths].sort((a, b) => a - b).map((len) => [len, round5(k * curveAt(shape, len))]);
}

/**
 * A load's own chronograph series cleaned up: readings that drop as the barrel gets longer (noise
 * from one shot string to the next) are pooled with their neighbors, and the series is extended to
 * the given lengths. The extension follows `shape`, a similar load's curve, scaled to meet the series
 * at its nearest end; without one, the slope of the series' last four inches is extended.
 */
export function cleanSeries(series: MvCurve, extendTo: readonly number[] = [], shape?: MvCurve): [number, number][] {
  // Pool adjacent violators: average any run that is not increasing.
  const blocks: { lens: number[]; sum: number }[] = [];
  for (const [len, fps] of series) {
    blocks.push({ lens: [len], sum: fps });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.lens.length < b.sum / b.lens.length) break;
      blocks.splice(-2, 2, { lens: [...a.lens, ...b.lens], sum: a.sum + b.sum });
    }
  }
  const clean: [number, number][] = blocks.flatMap((b) => b.lens.map((len) => [len, round5(b.sum / b.lens.length)] as [number, number]));
  const first = clean[0];
  const last = clean[clean.length - 1];
  const extend = (len: number) => {
    if (!shape) return curveAt(clean, len);
    const [endLen, endFps] = len < first[0] ? first : last;
    return (curveAt(shape, len) * endFps) / curveAt(shape, endLen);
  };
  const extra = extendTo.filter((len) => len < first[0] || len > last[0]);
  return [...clean, ...extra.map((len) => [len, round5(extend(len))] as [number, number])].sort((a, b) => a[0] - b[0]);
}
