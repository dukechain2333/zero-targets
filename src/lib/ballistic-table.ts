// Range-by-range ballistic data for the quick card and the detailed table.

import { sampleTrajectory } from "./ballistics/solver";
import type { ZeroResult } from "./compute";
import type { AngularUnit, ClickPreset } from "./presets";
import type { Setup } from "./setup";
import { angularInches } from "./target/scene";
import { distanceFromDisplay, distanceToDisplay, energy } from "./units";

export interface TableRow {
  rangeYd: number;
  /** Bullet path relative to the line of sight, inches (+ = above). */
  pathIn: number;
  /** Elevation correction in the table's angular unit (+ = hold / dial up). */
  elevation: number;
  /** Elevation correction in turret clicks (+ = up). */
  elevationClicks: number;
  /** Wind drift for the configured crosswind, inches (always positive, downwind). */
  windIn: number;
  /** Wind correction in the table's angular unit (hold / dial into the wind). */
  wind: number;
  windClicks: number;
  velocityFps: number;
  /** In the display unit system: ft-lb or J. */
  energy: number;
  timeS: number;
  subsonic: boolean;
}

export interface BallisticTable {
  unit: AngularUnit;
  click: ClickPreset;
  rows: TableRow[];
  /** Coarser rows that fit on a wallet card. */
  cardRows: TableRow[];
  /** First range at which the bullet is subsonic, if it starts supersonic. */
  subsonicYd: number | null;
}

/** Wind columns use the usual dope-card reference: a 10 mph full-value crosswind. */
export const TABLE_WIND_MPH = 10;

const CARD_STEPS = [10, 25, 50, 100, 200];
const MAX_CARD_ROWS = 12;

function rangesFor(maxYd: number, stepYd: number, setup: Setup): number[] {
  // Round numbers in the display unit (25, 50, 75 yd or m), converted to yards.
  const maxD = distanceToDisplay(maxYd, setup.units);
  const stepD = distanceToDisplay(stepYd, setup.units);
  const out: number[] = [];
  for (let i = 1; i * stepD <= maxD + 1e-6; i++) out.push(distanceFromDisplay(i * stepD, setup.units));
  return out;
}

export function buildBallisticTable(setup: Setup, result: ZeroResult): BallisticTable {
  const { resolved, input, elevationRad } = result;
  const unit = resolved.click.unit;
  const click = resolved.click;
  const speedOfSound = resolved.atmosphere.speedOfSoundFps;
  const supersonicStart = resolved.muzzleVelocityFps > speedOfSound;

  const makeRows = (ranges: number[]): TableRow[] => {
    const still = sampleTrajectory(input, elevationRad, ranges);
    const windy = sampleTrajectory({ ...input, crosswindMph: TABLE_WIND_MPH }, elevationRad, ranges);
    return still.map((p, i) => {
      const perUnit = angularInches(unit, p.rangeYd);
      const elevation = -p.heightIn / perUnit;
      const windIn = Math.abs(windy[i]?.windageIn ?? 0);
      const wind = windIn / perUnit;
      return {
        rangeYd: p.rangeYd,
        pathIn: p.heightIn,
        elevation,
        elevationClicks: Math.round(elevation / click.size),
        windIn,
        wind,
        windClicks: Math.round(wind / click.size),
        velocityFps: p.velocityFps,
        energy: energy(resolved.weightGr, p.velocityFps, setup.units),
        timeS: p.timeS,
        subsonic: p.velocityFps < speedOfSound,
      };
    });
  };

  const rows = makeRows(rangesFor(setup.tableMaxYd, setup.tableStepYd, setup));

  const maxD = distanceToDisplay(setup.tableMaxYd, setup.units);
  const cardStepD = CARD_STEPS.find((s) => maxD / s <= MAX_CARD_ROWS) ?? CARD_STEPS[CARD_STEPS.length - 1];
  const cardRows = makeRows(rangesFor(setup.tableMaxYd, distanceFromDisplay(cardStepD, setup.units), setup));

  let subsonicYd: number | null = null;
  if (supersonicStart) {
    // 5 yd resolution is plenty for a note.
    const probe: number[] = [];
    for (let r = 5; r <= Math.max(setup.tableMaxYd, 100) * 1.5; r += 5) probe.push(r);
    subsonicYd = sampleTrajectory(input, elevationRad, probe).find((p) => p.velocityFps < speedOfSound)?.rangeYd ?? null;
  }

  return { unit, click, rows, cardRows, subsonicYd };
}
