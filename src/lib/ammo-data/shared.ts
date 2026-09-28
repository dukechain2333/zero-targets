// Caliber groups, shared sources and per-caliber presets for the load catalog.
//
// Muzzle velocity by barrel length comes from chronograph tests where they exist. Values between
// lengths are interpolated by the app. "confidence" says how much of the curve is measured:
//   high    the load's own chronograph series across barrel lengths
//   medium  the load measured at a couple of lengths; a similar load's measured curve fills the rest
//   low     one reading, or only the maker's rating, on a similar load's curve
//
// Main sources:
//   LuckyGunner 2026 barrel-length tests (AR-pattern guns, 5-shot averages at the muzzle)
//   rifleshooter.com cut-down tests (bolt gun, cut an inch at a time; reads ~20-50 fps above an AR)
//   Ballistics by the Inch (9mm), Sniper Central and PrecisionRifleBlog ammo comparisons,
//   manufacturer spec pages, FM 3-22.9

export const G556 = "5.56 NATO / .223 Rem";
export const GBLK = ".300 AAC Blackout";
export const G9 = "9mm Luger (carbine)";
export const G762 = "7.62x39";
export const G308 = ".308 Win / 7.62x51 NATO";
export const G65 = "6.5 Creedmoor";

export const LG_223 = { label: "LuckyGunner .223/5.56 barrel length test (2026)", url: "https://www.luckygunner.com/lounge/223-ballistics/" };
export const LG_BLK = { label: "LuckyGunner .300 Blackout barrel length test (2026)", url: "https://www.luckygunner.com/lounge/300-blackout-ballistics/" };
export const LG_X39 = {
  label: "LuckyGunner 7.62x39 barrel length test (2026)",
  url: "https://www.luckygunner.com/lounge/7-62x39-barrel-length-vs-velocity-what-the-data-shows/",
};
export const RS_223 = {
  label: "rifleshooter.com .223/5.56 barrel length, 26 to 6 in",
  url: "https://rifleshooter.com/2015/12/223-remington-5-56mm-nato-barrel-length-and-velocity-26-inches-to-6-inches/",
};
export const RS_223_LONG = {
  label: "rifleshooter.com .223/5.56 barrel length, 26 to 16.5 in (2014)",
  url: "https://rifleshooter.com/2014/04/223-remington5-56-nato-velocity-versus-barrel-length-a-man-his-chop-box-and-his-friends-rifle/",
};
export const RS_223_SHORT = {
  label: "rifleshooter.com .223/5.56 short barrels, 14 to 6 in (2015)",
  url: "https://rifleshooter.com/2015/11/223-remington5-56mm-nato-barrel-length-versus-velocity-short-barrels-6-to-14-inches/",
};
export const RS_308 = {
  label: "rifleshooter.com .308/7.62x51 barrel length, 28 to 16.5 in",
  url: "https://rifleshooter.com/2014/12/308-winchester-7-62x51mm-nato-barrel-length-versus-velocity-28-to-16-5/",
};
export const RS_65 = {
  label: "rifleshooter.com 6.5 Creedmoor barrel length (2019)",
  url: "https://rifleshooter.com/2019/03/6-5-creedmoor-effects-of-barrel-length-on-velocity-2019/",
};
export const RS_65_RIFLES = {
  label: "rifleshooter.com 6.5 Creedmoor in 22 and 26 in rifles (2019)",
  url: "https://rifleshooter.com/2019/11/6-5-creedmoor-barrel-speed-can-shorter-barrels-shoot-faster/",
};
export const PRB_65 = {
  label: "PrecisionRifleBlog 6.5 Creedmoor factory ammo velocity (2021)",
  url: "https://precisionrifleblog.com/2021/05/28/6-5-creedmoor-ammo-review-muzzle-velocity/",
};
export const SC_M80 = { label: "Sniper Central M80 comparison", url: "https://snipercentral.com/m80-ammo-comparison-test/" };
export const SC_168 = { label: "Sniper Central .308 168 gr match comparison", url: "https://snipercentral.com/308-match-ammo-comparison-168gr/" };
export const SC_175 = { label: "Sniper Central .308 175 gr match comparison", url: "https://snipercentral.com/308-match-ammo-comparison-175gr/" };
export const BBTI_9 = { label: "Ballistics by the Inch, 9mm Luger", url: "http://www.ballisticsbytheinch.com/9luger.html" };
export const FM_3_22_9 = { label: "US Army FM 3-22.9 Rifle Marksmanship" };

/** Barrel lengths offered as presets for each caliber, inches. */
export const BARREL_PRESETS_BY_GROUP: Record<string, number[]> = {
  [G556]: [7.5, 10.3, 11.5, 12.5, 14.5, 16, 18, 20],
  [GBLK]: [7.5, 9, 10.5, 12.5, 16],
  [G9]: [4.5, 5.5, 8, 10.5, 16],
  [G762]: [7.5, 10.5, 12.5, 16],
  [G308]: [12.5, 14.5, 16, 18, 20, 22],
  [G65]: [16, 18, 20, 22, 24],
};

/** Default longest range of the ballistic card and table for each caliber, yards. */
export const TABLE_RANGE_BY_GROUP: Record<string, number> = {
  [G556]: 500,
  [GBLK]: 300,
  [G9]: 150,
  [G762]: 400,
  [G308]: 800,
  [G65]: 1000,
};
