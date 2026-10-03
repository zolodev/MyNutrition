// Tidslinje över dygnet: färgade fält i spåret och etiketter under.
// Etiketterna placeras efter sin faktiska bredd i pixlar och flyttas till en ny rad när de skulle krocka,
// så att de går att läsa även på en smal mobilskärm. Placeringen görs om när tidslinjen byter storlek
// (till exempel när en flik visas eller telefonen vrids).

import { esc } from "../util.js";

const percent = (hours) => `${(Math.min(24, Math.max(0, hours)) / 24) * 100}%`;
const ROW_PX = 20;
const GAP_PX = 10;

const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver((items) => items.forEach((i) => layoutLabels(i.target))) : null;

/** segments: [{ from, to, cls, label }] i timmar, marks: [{ at, label }]. */
export function renderTimeline(el, segments, marks) {
  const track =
    segments.map((s) => `<div class="tl-seg ${s.cls}" style="left:${percent(s.from)};width:${percent(s.to - s.from)}"></div>`).join("") +
    marks.map((m) => `<div class="tl-mark" style="left:${percent(m.at)}"></div>`).join("");
  const labels = [
    ...segments.map((s) => ({ x: (s.from + s.to) / 2, text: s.label, key: `<i class="${s.cls}"></i>` })),
    ...marks.map((m) => ({ x: m.at, text: m.label, key: '<i class="mark"></i>' })),
  ].sort((a, b) => a.x - b.x);

  el.innerHTML =
    `<div class="tl-track">${track}</div>` +
    `<div class="tl-labels">${labels.map((l) => `<span class="tl-label" data-x="${l.x}">${l.key}${esc(l.text)}</span>`).join("")}</div>` +
    `<div class="tl-axis">${[0, 6, 12, 18, 24].map((h) => `<span style="left:${percent(h)}">${String(h).padStart(2, "0")}</span>`).join("")}</div>`;
  el.setAttribute("aria-label", labels.map((l) => l.text).join(", "));
  layoutLabels(el);
  resizeObserver?.observe(el);
}

/** Lägg varje etikett så nära sin tidpunkt som möjligt, på första raden där den inte krockar med en annan. */
function layoutLabels(el) {
  const box = el.querySelector(".tl-labels");
  if (!box) return;
  const width = box.clientWidth;
  if (!width) return; // dold flik: görs när den visas
  const rowEnds = [];
  for (const label of box.querySelectorAll(".tl-label")) {
    const w = label.offsetWidth;
    const left = Math.max(0, Math.min(width - w, (Number(label.dataset.x) / 24) * width - w / 2));
    let row = rowEnds.findIndex((end) => end + GAP_PX <= left);
    if (row < 0) row = rowEnds.push(0) - 1;
    rowEnds[row] = left + w;
    label.style.left = `${left}px`;
    label.style.top = `${row * ROW_PX}px`;
  }
  box.style.height = `${Math.max(1, rowEnds.length) * ROW_PX}px`;
}
