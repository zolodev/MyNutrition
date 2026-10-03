// Små hjälpfunktioner som används i hela appen.

export const $ = (id) => document.getElementById(id);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Värdet på den valda radioknappen i en grupp. */
export const radioValue = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
export const setRadio = (name, value) => {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
};

/** Escape:a text innan den läggs i HTML. */
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Svenskt talformat med ett fast antal decimaler. */
export const fmt = (n, decimals = 0) =>
  Number(n).toLocaleString("sv-SE", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

/** "+1,2" / "−0,4" / "±0,0" */
export const signed = (x, decimals = 1) => (x > 0 ? "+" : x < 0 ? "−" : "±") + fmt(Math.abs(x), decimals);

/** Tolka ett tal från ett formulärfält (tillåter decimalkomma). Ger null om det inte är ett tal. */
export const num = (v) => {
  const x = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
};

/**
 * Sifferfält (data-decimal i index.html) är textfält, så att både 85,5 och 85.5 fungerar på alla tangentbord.
 * Här kontrolleras att värdet är ett tal inom min–max; tomt fält hanteras av required.
 */
export function checkDecimal(el) {
  const text = el.value.trim();
  const x = num(text);
  const min = el.min === "" ? -Infinity : Number(el.min);
  const max = el.max === "" ? Infinity : Number(el.max);
  el.setCustomValidity(
    !text ? "" :
    !/^\d+([.,]\d+)?$/.test(text) || x == null ? "Skriv ett tal, t.ex. 85,5 eller 85.5" :
    x < min || x > max ? `Ange ett värde mellan ${String(min).replace(".", ",")} och ${String(max).replace(".", ",")}` : "",
  );
  return el.validity.valid;
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Klockslag från timmar, t.ex. 7.5 → "07:30". Appen använder bara hela och halva timmar. */
export const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;


// ---------- Lagring i webbläsaren ----------
// localStorage kan saknas eller vara spärrat (privat läge); då fungerar appen ändå, men sparar inget.

export function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ingen lagring tillgänglig */
  }
}

// ---------- Datum och veckor ----------
// Veckor räknas som antal veckor sedan måndagen 2024-01-01, så att samma vecka alltid får samma nummer.

export const DAY_MS = 864e5;
const EPOCH = Date.UTC(2024, 0, 1);

export const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
export const DAYS_SHORT = DAYS.map((d) => d.slice(0, 3));

export const weekIndexOf = (date) =>
  Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / DAY_MS / 7);
export const mondayOf = (week) => new Date(EPOCH + week * 7 * DAY_MS);
/** Index 0–6 för dagens veckodag, där 0 är måndag. */
export const todayIndex = () => (new Date().getDay() + 6) % 7;

export function isoWeekNumber(dateUtc) {
  const d = new Date(dateUtc.getTime());
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - jan4) / DAY_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

/** Dagens datum som "ÅÅÅÅ-MM-DD" i lokal tid. */
export const todayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};
/** "ÅÅÅÅ-MM-DD" ↔ dagnummer, för att räkna med datum. */
export const dateToDay = (s) => Date.parse(s + "T00:00:00Z") / DAY_MS;
export const dayToDate = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const svDate = (s, opts = { day: "numeric", month: "short" }) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("sv-SE", { ...opts, timeZone: "UTC" });

// ---------- Slump som går att upprepa ----------
// Samma frö ger alltid samma följd, så att en vecka alltid får samma meny.

export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Gränssnitt ----------

/** Kort meddelande högst upp som försvinner av sig själv. */
export function toast(text, ms = 4000) {
  const el = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
  el.setAttribute("role", "status");
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

/**
 * Fråga med en modal (#confirm i index.html) och svara true för Ja, false för Nej, Escape eller klick utanför.
 * Webbläsare utan showModal (t.ex. jsdom) får dialogen öppnad med attributet open.
 */
export function confirmDialog(question, detail = "") {
  const dialog = $("confirm");
  $("confirm-text").textContent = question;
  $("confirm-detail").textContent = detail;
  $("confirm-detail").hidden = !detail;
  return new Promise((resolve) => {
    const finish = (yes) => {
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.close) dialog.close();
      else dialog.removeAttribute("open");
      resolve(yes);
    };
    const onClick = (ev) => {
      const answer = ev.target.closest("[data-answer]")?.dataset.answer;
      if (answer) finish(answer === "yes");
      else if (ev.target === dialog) finish(false); // klick på bakgrunden
    };
    const onCancel = (ev) => {
      ev.preventDefault();
      finish(false);
    };
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("cancel", onCancel);
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector('[data-answer="no"]').focus();
  });
}
