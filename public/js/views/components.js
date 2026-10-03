// Små byggstenar som flera vyer använder.

import { fmt } from "../util.js";

export const CHEVRON = '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
export const EXTERNAL = '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';

/** En ruta med ett nyckeltal. */
export const tile = ({ label, value, unit = "", sub = "", subClass = "", main = false }) =>
  `<div class="tile${main ? " main" : ""}"><span class="eyebrow">${label}</span><span class="v num">${value}${unit ? ` <small>${unit}</small>` : ""}</span><span class="sub ${subClass}">${sub}</span></div>`;

/** Kalorier och makron på en rad. */
export const macroLine = (m) =>
  `<div class="macros"><span><b>${fmt(m.k)}</b> kcal</span><span>P <b>${fmt(m.p)}</b> g</span><span>K <b>${fmt(m.c)}</b> g</span><span>F <b>${fmt(m.f)}</b> g</span></div>`;
