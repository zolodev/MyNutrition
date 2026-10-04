// Export och import av allt användaren har sparat: profil, logg, plan, allergier, egna livsmedel och recept m.m.
// Exporten är en ögonblicksbild av allt sparat (alla nycklar som börjar på "ffv"), så att nya nycklar kommer med
// automatiskt. En import ersätter allt sparat på enheten; äldre exportfiler (version 1) och rena logglistor läses också.

import { load, save, remove, keys, clearAll, flush } from "./storage.js";
import { APP_VERSION } from "./version.js";
import { DAYS, hhmm } from "./util.js";

const APP = "fettforbranningsveckan";
const VERSION = 2;
// Gäller bara den här enheten och flyttas inte med
const DEVICE_ONLY = new Set(["ffv-install-declined", "ffv-swipe-hint", "ffv-terms"]);
const isDataKey = (k) => (k === "ffv" || k.startsWith("ffv-")) && !DEVICE_ONLY.has(k);

const storedKeys = () => keys().filter(isDataKey);

/** Finns det sparad data på enheten som en import skulle skriva över? */
export const hasStoredData = () => storedKeys().length > 0;

/**
 * Profilen i klartext högst upp i exporten, så att den går att läsa (t.ex. gymdagarna, som sparas som "1,3,5").
 * Bara för människor: importen läser `data`.
 */
function overview(data) {
  const p = data.ffv || {};
  const days = String(p["tdays-val"] || "").split(",").filter(Boolean).map((d) => DAYS[Number(d)]?.toLowerCase()).filter(Boolean);
  return {
    "Kön": p.sex === "k" ? "Kvinna" : p.sex === "m" ? "Man" : "–",
    "Ålder": p.age || "–",
    "Vikt (kg)": p.weight || "–",
    "Längd (cm)": p.height || "–",
    "Målvikt (kg)": p.goal || "–",
    "Gymdagar": days.join(", ") || "–",
    "Utrustning": { gym: "Gym", db: "Hantlar", bw: "Kroppsvikt" }[p.eq] || "–",
    "Frukost klockan": p.bfast ? hhmm(Number(p.bfast)) : "–",
    "Loggade dagar": data["ffv-log"]?.entries?.length ?? 0,
  };
}

/** Allt sparat som JSON-text, för fil eller urklipp. */
export function exportText() {
  const data = Object.fromEntries(storedKeys().sort().map((k) => [k, load(k)]));
  return JSON.stringify({ app: APP, version: VERSION, appVersion: APP_VERSION, exported: new Date().toISOString(), oversikt: overview(data), data }, null, 2);
}

/**
 * Läs en export. Ger { data: {nyckel: värde}, replaceAll } eller { error }.
 * Version 2 ersätter allt; äldre format ersätter bara det de innehåller.
 */
export function readBackup(text) {
  let json;
  try {
    json = JSON.parse(String(text).trim());
  } catch {
    return { error: "Texten är inte en giltig export. Kopiera hela texten, från { till }." };
  }
  if (Array.isArray(json)) return { data: { "ffv-log": { entries: json } }, replaceAll: false };
  if (!json || typeof json !== "object") return { error: "Hittade inga uppgifter att importera." };
  if (json.version === VERSION && json.data && typeof json.data === "object") {
    const data = Object.fromEntries(Object.entries(json.data).filter(([k]) => isDataKey(k)));
    return Object.keys(data).length ? { data, replaceAll: true } : { error: "Exporten är tom." };
  }
  // Version 1: { settings, goal, plan, exclusions, myFoods, myRecipes, entries }
  const data = {};
  if (json.settings && typeof json.settings === "object") data.ffv = typeof json.goal === "number" ? { ...json.settings, goal: String(json.goal) } : json.settings;
  if (Array.isArray(json.entries)) data["ffv-log"] = { entries: json.entries };
  if (json.plan && Number.isInteger(json.plan.seed)) {
    data["ffv-seed"] = json.plan.seed;
    data["ffv-salt"] = json.plan.salts || {};
    if (Number.isInteger(json.plan.trainingSeed)) data["ffv-tseed"] = json.plan.trainingSeed;
  }
  if (json.exclusions && typeof json.exclusions === "object") data["ffv-excl"] = json.exclusions;
  if (Array.isArray(json.myFoods)) data["ffv-myfoods"] = json.myFoods;
  if (Array.isArray(json.myRecipes)) data["ffv-myrecipes"] = json.myRecipes;
  return Object.keys(data).length ? { data, replaceAll: false } : { error: "Hittade inga uppgifter att importera." };
}

/** Kort beskrivning av vad en export innehåller, t.ex. "profil, 12 loggposter, allergival". */
export function describe(data) {
  const parts = [];
  if (data.ffv) parts.push("profil");
  const log = data["ffv-log"]?.entries?.length;
  if (log) parts.push(`${log} loggpost${log > 1 ? "er" : ""}`);
  if ("ffv-seed" in data) parts.push("plankod");
  if (data["ffv-excl"]) parts.push("allergier och bortval");
  if (data["ffv-myfoods"]?.length) parts.push("egna livsmedel");
  if (data["ffv-myrecipes"]?.length) parts.push("egna recept");
  if (data["ffv-supps"]) parts.push("tillskott");
  return parts.join(", ") || "inställningar";
}

/** Radera allt appen har sparat, även det som bara gäller enheten (som godkända villkor). Ger ett löfte. */
/**
 * Radera all data: allt sparat (IndexedDB och localStorage), webbappens cache och service workern, så att nästa
 * start är helt ny. Samma som "Radera all data och börja om" på laddningsskärmen (ffvRecover i index.html).
 */
export async function eraseAll() {
  await clearAll();
  try {
    for (const k of Object.keys(sessionStorage)) if (k === "ffv" || k.startsWith("ffv-")) sessionStorage.removeItem(k);
  } catch {
    /* ingen sessionStorage */
  }
  const tasks = [];
  if (navigator.serviceWorker) tasks.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))));
  if (globalThis.caches) tasks.push(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  await Promise.allSettled(tasks);
}

/** Spara en export. Vid replaceAll tas allt annat sparat bort först. Ger ett löfte som är klart när allt är skrivet. */
export function restore({ data, replaceAll }) {
  if (replaceAll) for (const k of storedKeys()) remove(k);
  for (const [k, v] of Object.entries(data)) if (!save(k, v)) throw new Error("Kunde inte spara");
  return flush();
}
