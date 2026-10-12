# MyNutrition (Fettförbränningsveckan)

Statisk PWA i `public/` (HTML, CSS, JavaScript-moduler utan byggsteg), publicerad med Cloudflare (`wrangler deploy`).
All kommunikation med användaren sker på svenska. Arkitekturen beskrivs i `docs/ARCHITECTURE.md`.

## Viktigast: användarens data får aldrig försvinna

Läs och följ skillen `datakompatibilitet` (`.claude/skills/datakompatibilitet/SKILL.md`) innan du ändrar något i
`public/` eller släpper en version. Alla ändringar måste vara kompatibla med data från tidigare versioner. Föreslå
aldrig att användaren rensar webbplatsdata.

## Arbetssätt

- Kör testerna med `bun tests/run.mjs` efter varje ändring.
- Höj versionen med `npm run bump -- patch|minor` (semver) och skriv i `CHANGELOG.md`.
- Håll verktyg och testberoenden uppdaterade (`bun upgrade`, `bun outdated`, `bun audit`).
