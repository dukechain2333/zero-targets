// Setup-specific zeroing instructions, shared by the web page and page 2 of the PDF.

import type { ZeroResult } from "./compute";
import type { Setup } from "./setup";
import { clicksPerSquareText, distanceLabel, unitLabel, type GridSpec } from "./target/scene";
import {
  distanceToDisplay,
  distanceUnit,
  fmtBarrel,
  fmtOffset,
  fmtSightHeight,
  fmtVelocity,
  MM_PER_IN,
  trimNumber,
} from "./units";

export interface Guide {
  title: string;
  subtitle: string;
  facts: [label: string, value: string][];
  steps: { heading: string; body: string[] }[];
  notes: string[];
}

const roundDistance = (yd: number, u: Setup["units"]) => `${Math.round(distanceToDisplay(yd, u))} ${distanceUnit(u)}`;

export function buildGuide(setup: Setup, result: ZeroResult, grid: GridSpec): Guide {
  const { resolved, offsetIn, sensitivity } = result;
  const u = setup.units;
  const target = distanceLabel(setup.targetYd, u);
  const zero = distanceLabel(setup.zeroYd, u);
  const unit = unitLabel(grid.unit);
  const squareSize = u === "metric" ? `${(grid.stepIn * MM_PER_IN).toFixed(1)} mm` : `${grid.stepIn.toFixed(2)} in`;
  const offsetAngle = Math.abs(grid.unit === "moa" ? result.offsetMoa : result.offsetMil);
  const dist = Math.abs(offsetIn);
  const where = dist < 0.005 ? "on" : offsetIn < 0 ? "below" : "above";
  const sameDistance = Math.abs(setup.targetYd - setup.zeroYd) < 0.01;
  const cps = grid.step / resolved.click.size;
  const exampleSquares = 3;
  const exampleClicks = Math.round(exampleSquares * cps * 100) / 100;
  const [nearYd, farYd] = result.crossingsYd;
  const scaleLabel = u === "metric" ? "50 mm" : "2.00 in";

  const mvText =
    resolved.mvSource === "measured"
      ? `${fmtVelocity(resolved.muzzleVelocityFps, u)} (your chronograph value)`
      : `${fmtVelocity(resolved.muzzleVelocityFps, u)} (estimated for a ${fmtBarrel(setup.barrelIn)} barrel${resolved.mvSource === "extrapolated" ? ", outside published data" : ""})`;

  const facts: Guide["facts"] = [
    ["Ammunition", resolved.loadName],
    ["Muzzle velocity", mvText],
    ["Barrel length", fmtBarrel(setup.barrelIn)],
    [
      "Sight height over bore",
      `${fmtSightHeight(resolved.sightHeightIn, u)} (${fmtSightHeight(setup.opticHeightIn, u)} optic + ${fmtSightHeight(setup.railToBoreIn, u)} rail to bore)`,
    ],
    ["Zero distance", farYd && nearYd ? `${zero} (bullet crosses the sight line at ${roundDistance(nearYd, u)} and ${roundDistance(farYd, u)})` : zero],
    ["Target distance", target],
    [
      `Impact at ${target}`,
      where === "on" ? "Same as point of aim" : `${fmtOffset(dist, u)} (${offsetAngle.toFixed(1)} ${unit}) ${where} point of aim`,
    ],
    ["Grid", `1 square = ${trimNumber(grid.step, 2)} ${unit} = ${squareSize} at ${target}`],
    ["Turret", `${resolved.click.label} per click: ${clicksPerSquareText(grid, resolved.click)}`],
  ];

  const steps: Guide["steps"] = [
    {
      heading: "Print the target at actual size",
      body: [
        `Print page 1 at 100% / "Actual size" (turn off "Fit to page"). Measure the scale bar at the bottom: it must be exactly ${scaleLabel}. If it is not, the offset on the target is wrong.`,
      ],
    },
    {
      heading: `Hang it at exactly ${target}`,
      body: [
        `Measure from the muzzle, not the firing line. Every ${u === "metric" ? "metre" : "yard"} of error moves the correct impact point by about ${fmtOffset(Math.abs(sensitivity.targetPlus1Yd) * (u === "metric" ? 1.0936 : 1), u)}.`,
      ],
    },
    {
      heading: "Fire a group at AIM",
      body: [
        "From a solid rest (bags, bipod or a bench), center the optic on AIM and fire a 3 to 5 shot group with the ammunition you will zero with. Keep the same cheek weld and head position for every shot.",
      ],
    },
    {
      heading: "Measure the group from IMPACT",
      body: [
        `Find the center of the group and count the squares between it and IMPACT, vertically and horizontally. Each square is ${trimNumber(grid.step, 2)} ${unit} (${squareSize} at ${target}), and major lines are every ${trimNumber(grid.step * grid.majorEvery, 2)} ${unit}.`,
      ],
    },
    {
      heading: "Adjust the optic",
      body: [
        `Move the group toward IMPACT: if it is high, dial DOWN; if it is left, dial RIGHT. Turrets are marked in the direction the impacts move.`,
        `With ${resolved.click.label} clicks: ${clicksPerSquareText(grid, resolved.click)}. Example: a group ${exampleSquares} squares high needs ${trimNumber(exampleClicks, 2)} click${exampleClicks === 1 ? "" : "s"} DOWN.`,
      ],
    },
    {
      heading: "Repeat until the group centers on IMPACT",
      body: [
        "Fire another group and adjust again. Stop when the group center is within about one square of IMPACT: that is as fine as a short-range zero can resolve.",
      ],
    },
  ];

  if (!sameDistance) {
    steps.push({
      heading: `Confirm at ${zero}`,
      body: [
        `A short-range zero relies on the modeled sight height and muzzle velocity. When you can, shoot a group at ${zero}: it should land on the point of aim. Fine-tune there.`,
        result.apex && result.apex.heightIn < 0.25
          ? `With this zero the bullet only just reaches the sight line: it peaks ${fmtOffset(result.apex.heightIn, u)} above it at ${roundDistance(result.apex.rangeYd, u)} and is below it everywhere else.`
          : farYd && nearYd
            ? `With this zero the bullet crosses the sight line at ${roundDistance(nearYd, u)} and again at ${roundDistance(farYd, u)}${result.apex ? `, peaking ${fmtOffset(result.apex.heightIn, u)} high at ${roundDistance(result.apex.rangeYd, u)}` : ""}.`
            : "",
      ].filter(Boolean),
    });
  }

  const notes = [
    `Bullet path from a point-mass solver using the ${resolved.dragModel} ballistic coefficient ${resolved.bc}, ICAO standard atmosphere (sea level, 59 °F / 15 °C), no wind, level shot. Short-range zeroing barely depends on weather.`,
    `If your real muzzle velocity is 100 fps slower, the impact point moves ${fmtOffset(Math.abs(sensitivity.mvMinus100Fps), u)}. If your sight is 0.1 in (2.5 mm) higher, it moves ${fmtOffset(Math.abs(sensitivity.sightHeightPlusTenth), u)}.`,
    "Sight height is what matters most. Measure from the bore centerline to the center of the optic if your mount height is unknown.",
  ];

  return {
    title: `Zeroing guide: ${target} target for a ${zero} zero`,
    subtitle: `${resolved.loadShort}, ${fmtBarrel(setup.barrelIn)} barrel, ${fmtSightHeight(setup.opticHeightIn, u)} optic height`,
    facts,
    steps,
    notes,
  };
}
