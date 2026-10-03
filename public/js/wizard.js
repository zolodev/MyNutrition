// Guide första gången (och efter "Rensa mina uppgifter"): profilformuläret flyttas in i en helskärmsvy och visas
// ett steg i taget. Fälten markeras med data-step i index.html. Guiden sparar inget själv; när användaren är klar
// flyttas formuläret tillbaka och `onDone` får de valda allergierna, så att app.js sparar allt på en gång.

import { $, $$, esc } from "./util.js";
import { ALLERGENS } from "./data/foods.js";
import { parseTrainingDays } from "./training.js";

const STEPS = [
  { title: "Välkommen! Börja med dig", intro: "Kalorier, protein och portioner räknas efter dina uppgifter. De sparas bara på den här enheten." },
  { title: "Ditt mål", intro: "Målvikten och takten avgör hur stort kaloriunderskottet blir." },
  { title: "Träning", intro: "Utrustningen och dagarna styr träningsprogrammet." },
  { title: "Mat", intro: "Frukosten och tiderna styr veckans meny och fastan. Recepten anpassas efter det du inte tål." },
];
const REQUIRED = ["age", "weight", "height", "goal"];

/** Öppna guiden. `allergens` är de allergier som redan är valda (en Set). */
export function openWizard(allergens, onDone) {
  const form = $("f");
  const home = { parent: form.parentNode, next: form.nextSibling };
  $("wz-body").append(form);

  // Egna värden krävs: töm exempelvärdena och låt användaren välja kön
  for (const id of REQUIRED) Object.assign($(id), { value: "", required: true });
  const sex = $$('input[name="sex"]');
  for (const el of sex) el.checked = false;
  sex[0].required = true;
  $("wz-allergens").innerHTML = ALLERGENS.map((a) =>
    `<label class="chip-check"><input type="checkbox" data-wz-allergen="${a.id}"${allergens.has(a.id) ? " checked" : ""}><span>${esc(a.n)}</span></label>`).join("");

  let step = 0;
  const show = () => {
    for (const el of $$("#wizard [data-step]")) el.hidden = Number(el.dataset.step) !== step + 1;
    $("wz-progress").textContent = `Steg ${step + 1} av ${STEPS.length}`;
    $("wz-title").textContent = STEPS[step].title;
    $("wz-intro").textContent = STEPS[step].intro;
    $("wz-msg").textContent = "";
    $("wz-back").hidden = step === 0;
    $("wz-next").textContent = step === STEPS.length - 1 ? "Klar" : "Nästa";
    $("wizard").scrollTop = 0;
  };

  const stepIsValid = () => {
    const invalid = $$(`#wizard [data-step="${step + 1}"] :is(input, select)`).find((el) => !el.checkValidity());
    if (invalid) {
      const label = invalid.name === "sex" ? "Kön" : invalid.labels?.[0]?.firstChild.textContent.trim();
      $("wz-msg").textContent = `Fyll i ${label?.toLowerCase() || "alla fält"}${invalid.validationMessage && invalid.name !== "sex" ? ": " + invalid.validationMessage : ""}.`;
      invalid.focus();
      return false;
    }
    if (step === 2 && !parseTrainingDays($("tdays-val").value, []).valid) {
      $("wz-msg").textContent = "Välj 3 eller 4 gymdagar.";
      return false;
    }
    return true;
  };

  const finish = () => {
    $("wizard").hidden = true;
    for (const el of $$("#wizard [data-step]")) el.hidden = false;
    for (const el of [...REQUIRED.map($), sex[0]]) el.required = false;
    home.parent.insertBefore(form, home.next);
    $("wz-back").onclick = $("wz-next").onclick = null;
    onDone({ allergens: $$("[data-wz-allergen]:checked").map((el) => el.dataset.wzAllergen) });
  };

  $("wz-back").onclick = () => {
    step--;
    show();
  };
  $("wz-next").onclick = () => {
    if (!stepIsValid()) return;
    if (step === STEPS.length - 1) return finish();
    step++;
    show();
  };
  $("wizard").hidden = false;
  show();
}
