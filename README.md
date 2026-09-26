# zero-targets

Printable short-range zeroing targets. Enter your ammunition, barrel length, optic height, the zero
distance you want and the distance you can actually shoot at. zero-targets computes where the bullet
has to hit at that distance and gives you a 1:1 PDF target with an AIM point, the IMPACT point and a
grid in MOA or MIL, plus a setup-specific zeroing guide.

Everything runs in the browser: the ballistic solver, the target layout and the PDF export. The site
is a single statically rendered Next.js page, so it deploys to Vercel with no configuration.

## Features

- Presets for every input plus fully custom values: barrel length, optic height (riser), rail-to-bore
  height, zero distance, target distance.
- Ammunition picker with published muzzle velocity by barrel length for common 5.56, .300 BLK, 9mm,
  7.62x39, .308 and 6.5 Creedmoor loads, a chronograph override, and custom bullets (weight, G1/G7 BC).
- Imperial or metric units, MOA or MIL grids (from the turret click value), five paper sizes.
- Live preview that is drawn from the same geometry as the PDF, with a scale-check bar on the page.
- Zeroing guide (also page 2 of the PDF), bullet path chart and table.
- The whole setup is kept in the URL, so a link reproduces the same target.

## How the numbers are computed

`src/lib/ballistics/solver.ts` is a point-mass trajectory solver: RK4 integration, standard G1/G7 drag
tables with monotone cubic interpolation, ICAO standard atmosphere, no wind. It solves the bore angle
that puts the bullet on the line of sight at the zero distance, then reads the bullet path at the target
distance. Sight height = optic height above the rail + rail-to-bore height (1.21 in for an AR-15 flat-top).

The solver is tested against [py-ballisticcalc](https://github.com/o-murphy/py-ballisticcalc) and agrees
to within 0.01 in out to 100 yd (`src/lib/ballistics/solver.test.ts`).

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # solver, target layout and URL state tests
npm run lint
npm run build
```

## Project layout

```
src/app/                  page, layout, global styles
src/components/           form fields, target preview, trajectory chart, guide
src/lib/ballistics/       solver and drag tables (+ reference fixture)
src/lib/ammo-data.ts      load presets and velocity-by-barrel data with sources
src/lib/compute.ts        setup -> offsets, crossings, sensitivity
src/lib/target/scene.ts   printable page as drawing primitives (inches)
src/lib/target/pdf.ts     jsPDF renderer for the scene and the guide page
src/lib/guide.ts          setup-specific zeroing instructions
```

## Deploying to Vercel

Import the repository in Vercel (framework preset: Next.js) or run `npx vercel` in this folder. No
environment variables are needed.

## Disclaimer

The offsets are only as good as the inputs; sight height matters most. Always confirm your zero at the
real distance.
