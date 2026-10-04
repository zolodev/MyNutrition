// Export och import: knapparna under Inställningar → Säkerhetskopia och delning, importen i guidens andra steg och Radera all
// data. Vad som exporteras och hur det läses tillbaka finns i backup.js. Importen varnar om den skriver över något
// och laddar sedan om sidan, så att alla delar av appen läser in de nya uppgifterna från början.

import { $, todayStr, confirmDialog, toast } from "../util.js";
import { exportText, readBackup, describe, restore, hasStoredData, eraseAll } from "../backup.js";

let acceptTerms = () => {}; // sätts av initBackupForms()

const IMPORTED_KEY = "ffv-imported"; // sessionStorage: visa ett kvitto efter omladdningen

const backupMessage = (text) => ($("backup-msg").textContent = text);

async function importBackup(text, say) {
  const backup = readBackup(text);
  if (backup.error) return say(backup.error);
  const what = describe(backup.data);
  const replaced = backup.replaceAll ? "allt som är sparat här" : "motsvarande uppgifter";
  if (hasStoredData() && !(await confirmDialog(
    "Det finns redan sparade uppgifter på den här enheten. Vill du skriva över dem?",
    `Importen ersätter ${replaced} med: ${what}. Det går inte att ångra; exportera först om du vill behålla det som finns.`,
  ))) return say("Importen avbröts. Inget har ändrats.");
  try {
    if (!$("wizard").hidden) acceptTerms(); // importen i guiden kommer efter villkorssteget
    await restore(backup);
  } catch {
    return say("Webbläsaren tillåter inte att uppgifterna sparas (t.ex. privat läge).");
  }
  try {
    sessionStorage.setItem(IMPORTED_KEY, what);
  } catch {
    /* kvittot är inte nödvändigt */
  }
  location.reload();
}

/** Läs en vald fil som text och importera den. */
async function importFile(input, say) {
  const file = input.files?.[0];
  input.value = "";
  if (file) importBackup(await file.text(), say);
}

$("l-export").addEventListener("click", () => {
  const data = exportText();
  const filename = `fettforbranning-${todayStr()}.json`;
  try {
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    backupMessage(`Allt är exporterat till ${filename}.`);
  } catch {
    backupMessage("Kunde inte spara filen här. Använd Kopiera allt i stället.");
  }
});
$("l-copy").addEventListener("click", async () => {
  const text = exportText();
  try {
    await navigator.clipboard.writeText(text);
    $("l-copytext").hidden = true;
    backupMessage("Allt är kopierat. Klistra in texten under Inställningar → Säkerhetskopia och delning på den andra enheten.");
  } catch {
    // T.ex. när webbläsaren nekar urklipp: visa texten så att den kan markeras och kopieras för hand
    Object.assign($("l-copytext"), { value: text, hidden: false });
    $("l-copytext").select();
    backupMessage("Kopieringen nekades. Texten visas nedan: markera allt och kopiera.");
  }
});
$("l-import").addEventListener("change", (ev) => importFile(ev.target, backupMessage));
$("l-paste-go").addEventListener("click", () => importBackup($("l-paste").value, backupMessage));

// Radera all data (Inställningar): drar också tillbaka godkännandet av villkoren
$("erase-all").addEventListener("click", async () => {
  const sure = await confirmDialog(
    "Är du säker på att du vill radera all data och dra tillbaka ditt godkännande?",
    "Allt som är sparat i den här webbläsaren raderas: profil, logg, plankod, allergier, egna livsmedel och recept och ditt godkännande av villkoren. Det går inte att ångra. Exportera först under Inställningar → Säkerhetskopia och delning om du vill behålla något.",
  );
  if (!sure) return;
  try {
    await eraseAll();
  } catch {
    /* ingen lagring att radera */
  }
  window.history.replaceState(null, "", location.pathname); // börja om från början (utan #installningar), med villkoren
  location.reload();
});

// Import som första steg i guiden
const wizardMessage = (text) => ($("wz-msg").textContent = text);
$("wz-import").addEventListener("change", (ev) => importFile(ev.target, wizardMessage));
$("wz-paste-toggle").addEventListener("click", (ev) => {
  $("wz-paste").hidden = !$("wz-paste").hidden;
  ev.currentTarget.setAttribute("aria-expanded", String(!$("wz-paste").hidden));
  if (!$("wz-paste").hidden) $("wz-paste-text").focus();
});
$("wz-paste-go").addEventListener("click", () => importBackup($("wz-paste-text").value, wizardMessage));

/** Koppla exporten och importen. `acceptTerms` godkänner villkoren när importen görs i guiden. */
export function initBackupForms(deps) {
  acceptTerms = deps.acceptTerms;
}

/** Efter en import laddas sidan om; visa då vad som lästes in. */
export function showImportReceipt() {
  try {
    const imported = sessionStorage.getItem(IMPORTED_KEY);
    sessionStorage.removeItem(IMPORTED_KEY);
    if (imported) toast(`Importen är klar: ${imported}.`, 5000);
  } catch {
    /* ingen sessionStorage */
  }
}
