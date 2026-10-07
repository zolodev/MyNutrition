// Guide första gången (och efter "Rensa mina uppgifter"): först välkommen och möjligheten att installera appen,
// sedan villkoren och profilformuläret ett steg i taget i en helskärmsvy. Fälten markeras med data-step i index.html
// (stegets plats i STEPS, räknat från 1). Guiden sparar inget själv; när användaren är klar
// flyttas formuläret tillbaka och `onDone` får de valda allergierna, så att app.js sparar allt på en gång.
// Med `termsOnly` visas bara villkoren, för den som redan har en profil men inte har godkänt dem.

import { $, $$, esc, checkDecimal } from "./util.js";
import { ALLERGENS } from "./data/foods.js";
import { parseTrainingDays } from "./training.js";
import { isStandalone, instructions, installApp, canPromptInstall } from "./pwa.js";

const STEPS = [
  { key: "welcome", title: "Välkommen", intro: "Ett verktyg för fettförbränning: mat, träning och fasta i en vecka i taget." },
  { key: "terms", title: "Innan du börjar", intro: "Läs igenom villkoren. De gäller hela appen." },
  { key: "start", title: "Har du redan använt appen?", intro: "Importera dina uppgifter eller använd en plankod du har fått. Har du inget av det, hoppa över steget." },
  { key: "you", title: "Börja med dig", intro: "Kalorier, protein och portioner räknas efter dina uppgifter. De sparas bara på den här enheten." },
  { key: "goal", title: "Ditt mål", intro: "Målvikten och takten avgör hur stort kaloriunderskottet blir." },
  { key: "training", title: "Träning", intro: "Utrustningen och dagarna styr träningsprogrammet." },
  { key: "food", title: "Mat", intro: "Frukosten och tiderna styr veckans meny och fastan. Recepten anpassas efter det du inte tål." },
  { key: "yours", title: "Make it yours", intro: "Gör appen till din, så får du ut det mesta av den." },
];
const REQUIRED = ["age", "weight", "height", "goal"];

/** Välkomststeget: hur appen installeras här, eller att den redan är installerad. */
function showInstall() {
  const installed = isStandalone();
  const how = instructions();
  $("wz-install-text").hidden = installed;
  $("wz-install-tip").hidden = installed || (!how && !canPromptInstall());
  $("wz-install").hidden = installed || (!how && !canPromptInstall());
  $("wz-install-how").textContent = installed ? "Du använder redan appen som installerad app. Bra!"
    : canPromptInstall() ? "Tryck på Installera appen, så frågar webbläsaren om du vill installera den."
    : how || "Den här webbläsaren kan inte installera webbappar. Öppna sidan i Chrome eller Edge för att installera den, eller lägg till ett bokmärke.";
}

/**
 * Öppna guiden. `allergens` är de allergier som redan är valda (en Set). `onStep(key)` anropas när ett steg visas.
 * `onDone({ allergens })` anropas när användaren är klar.
 */
export function openWizard({ allergens = new Set(), termsOnly = false, onStep = () => {} }, onDone) {
  const steps = termsOnly ? STEPS.filter((x) => x.key === "terms") : STEPS;
  const stepNo = () => STEPS.indexOf(steps[step]) + 1; // data-step för steget som visas
  const form = $("f");
  const home = { parent: form.parentNode, next: form.nextSibling };
  const sex = $$('input[name="sex"]');
  $("wz-terms").innerHTML = $("terms-text").innerHTML;
  $("wz-accept").checked = false;

  if (!termsOnly) {
    $("wz-body").append(form);
    // Egna värden krävs: töm exempelvärdena och låt användaren välja kön
    for (const id of REQUIRED) Object.assign($(id), { value: "", required: true });
    for (const el of sex) el.checked = false;
    sex[0].required = true;
    $("wz-allergens").innerHTML = ALLERGENS.map((a) =>
      `<label class="chip-check"><input type="checkbox" data-wz-allergen="${a.id}"${allergens.has(a.id) ? " checked" : ""}><span>${esc(a.n)}</span></label>`).join("");
  }

  delete $("wizard").dataset.planCode; // sätts när en plankod har använts i steget "start"
  let step = 0;
  // På villkorssteget går det inte vidare förrän villkoren är godkända
  const syncNext = () => ($("wz-next").disabled = steps[step].key === "terms" && !$("wz-accept").checked);
  $("wz-accept").onchange = syncNext;
  const show = () => {
    for (const el of $$("#wizard [data-step]")) el.hidden = Number(el.dataset.step) !== stepNo();
    $("wz-body").hidden = !form.querySelector(`[data-step="${stepNo()}"]`); // profilformuläret visas bara på steg med fält i det
    $("wz-progress").textContent = termsOnly ? "Villkor" : `Steg ${step + 1} av ${steps.length}`;
    $("wz-title").textContent = steps[step].title;
    $("wz-intro").textContent = steps[step].intro;
    $("wz-msg").textContent = "";
    $("wz-back").hidden = step === 0;
    $("wz-next").textContent = termsOnly ? "Godkänn och fortsätt" : step === steps.length - 1 ? "Kom igång"
      : steps[step].key === "start" && !$("wizard").dataset.planCode ? "Hoppa över" : "Nästa";
    syncNext();
    $("wizard").scrollTop = 0;
    if (steps[step].key === "welcome") showInstall();
    onStep(steps[step].key);
  };

  const stepIsValid = () => {
    const fields = $$(`#wizard [data-step="${stepNo()}"] :is(input, select)`);
    for (const el of fields) if (el.matches("[data-decimal]")) checkDecimal(el);
    const invalid = fields.find((el) => !el.checkValidity());
    if (invalid === $("wz-accept")) {
      $("wz-msg").textContent = "Kryssa i att du har läst och förstår villkoren för att fortsätta.";
      return false;
    }
    if (invalid) {
      const label = invalid.name === "sex" ? "Kön" : invalid.labels?.[0]?.firstChild.textContent.trim();
      $("wz-msg").textContent = `Fyll i ${label?.toLowerCase() || "alla fält"}${invalid.validationMessage && invalid.name !== "sex" ? ": " + invalid.validationMessage : ""}.`;
      invalid.focus();
      return false;
    }
    if (steps[step].key === "training" && !parseTrainingDays($("tdays-val").value, []).valid) {
      $("wz-msg").textContent = "Välj 3 eller 4 gymdagar.";
      return false;
    }
    return true;
  };

  const finish = () => {
    $("wizard").hidden = true;
    for (const el of $$("#wizard [data-step]")) el.hidden = false;
    $("wz-body").hidden = false;
    if (!termsOnly) {
      for (const el of [...REQUIRED.map($), sex[0]]) el.required = false;
      home.parent.insertBefore(form, home.next);
    }
    $("wz-back").onclick = $("wz-next").onclick = $("wz-accept").onchange = $("wz-install").onclick = null;
    $("wz-next").disabled = false;
    onDone({ allergens: $$("[data-wz-allergen]:checked").map((el) => el.dataset.wzAllergen) });
  };

  $("wz-install").onclick = async () => {
    await installApp();
    showInstall();
  };

  $("wz-back").onclick = () => {
    if (step === 0) return;
    step--;
    show();
  };
  $("wz-next").onclick = () => {
    if (!stepIsValid()) return;
    if (step === steps.length - 1) return finish();
    step++;
    show();
  };
  $("wizard").hidden = false;
  show();
}
