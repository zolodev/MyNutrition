// Mina mellanmål: egna snabbval när ett mellanmål läggs till på Idag (controllers/meal-swap.js). Läggs till, ändras
// och tas bort under Inställningar → Mina mellanmål. Sparas i `ffv-snacks` (från 0.23.0) som [{ id, n, k, p }],
// kalorier och protein per portion; okända fält behålls. Finns ingen sparad lista visas förslagen i SNACKS
// (data/meal-replacements.js), och första ändringen sparar hela listan.

import { load, save, readList, stableId } from "./util.js";
import { cleanSwap } from "./log.js";
import { SNACKS } from "./data/meal-replacements.js";

const KEY = "ffv-snacks";
const ID = /^sn_[\w-]+$/;

/** Ett eget mellanmål { id, n, k, p, … }, eller null om namnet saknas. */
export function cleanMySnack(x, i = 0) {
  const clean = cleanSwap(x);
  return clean && { ...x, ...clean, id: ID.test(x.id) ? x.id : stableId("sn_", `${i}:${clean.n}`) };
}

function read() {
  const saved = load(KEY);
  return saved === undefined ? { kept: SNACKS.map(cleanMySnack), rejected: [] } : readList(saved, cleanMySnack);
}
// Poster som inte går att läsa ligger kvar orörda och skrivs tillbaka vid sparning
const write = (list) => save(KEY, [...list, ...read().rejected]);

/** Mina mellanmål i sparad ordning. */
export const mySnacks = () => read().kept;

/** Lägg till ett mellanmål, eller ändra det med `id`. Ger det sparade mellanmålet, eller null om namnet saknas. */
export function saveMySnack(snack, id = null) {
  const list = mySnacks();
  const old = id && list.find((x) => x.id === id);
  const clean = cleanMySnack({ ...old, ...snack, id: old ? old.id : "sn_" + Math.random().toString(36).slice(2, 9) });
  if (!clean) return null;
  write(old ? list.map((x) => (x.id === id ? clean : x)) : [...list, clean]);
  return clean;
}

/** Ta bort ett mellanmål. */
export function removeMySnack(id) {
  write(mySnacks().filter((x) => x.id !== id));
}
