import type { Load } from "../ammo";
import { LOADS_BLK } from "./blk";
import { LOADS_65 } from "./creedmoor";
import { LOADS_9MM } from "./nine";
import { LOADS_556 } from "./rifle-556";
import { LOADS_308 } from "./win308";
import { LOADS_X39 } from "./x39";

/** Every load in the catalog, grouped by caliber in picker order. */
export const AMMO_DATA: Load[] = [...LOADS_556, ...LOADS_BLK, ...LOADS_9MM, ...LOADS_X39, ...LOADS_308, ...LOADS_65];

export { BARREL_PRESETS_BY_GROUP, TABLE_RANGE_BY_GROUP } from "./shared";
