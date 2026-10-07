// Träning: ett pass per rad, och varje övning är en klickbar rad som öppnar övningen i ExRx.

import { $, esc } from "../util.js";
import { EXRX_URL } from "../data/exercises.js";
import { EXTERNAL } from "./components.js";

const exerciseRow = (ex) =>
  `<a class="row exercise" href="${EXRX_URL + ex.path}" target="_blank" rel="noopener">` +
  `<span class="main"><b>${esc(ex.name)}</b>${ex.muscles ? `<small>${esc(ex.muscles)}</small>` : ""}</span>` +
  `<span class="end num">${ex.sets}${ex.rest ? `<small>vila ${ex.rest}</small>` : ""}</span>${EXTERNAL}</a>`;

const circuitBlock = (circuit) =>
  `<div class="circuit"><div class="circuit-head"><b>Intensiv bålcirkel</b><small>3 varv. Gå direkt mellan övningarna, vila 60–90 s efter varje varv.</small></div>` +
  circuit.items.map(exerciseRow).join("") + `</div>`;

export function sessionBlock(session) {
  const rows = session.items.map((item) => (item.circuit ? circuitBlock(item) : exerciseRow(item))).join("");
  const when = `${session.days.join(", ")} · ca 45–55 min inkl. uppvärmning`;
  return [
    '<div class="session">',
    `<div class="session-head"><h3>${session.name}</h3><span>${when}</span>`,
    `<button type="button" class="btn small" data-start-session="${esc(session.name)}">Starta passet</button></div>`,
    `<div class="list">${rows}</div>`,
    "</div>",
  ].join("");
}

export function renderProgram(program) {
  $("prog-title").textContent = program.title;
  $("prog-sub").textContent = `${program.summary} Varje stor muskelgrupp tränas två gånger i veckan, som ACSM rekommenderar (via ExRx).` +
    (program.clash
      ? " Med de här dagarna hamnar två pass för samma muskler i rad. Kör det andra passet lite lättare, eller flytta en dag så att det blir en vilodag emellan."
      : " Passen ligger så att samma muskler aldrig tränas två dagar i rad.");
  $("sessions").innerHTML = program.sessions.map(sessionBlock).join("");
}
