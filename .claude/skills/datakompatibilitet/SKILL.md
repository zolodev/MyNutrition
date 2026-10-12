---
name: datakompatibilitet
description: Obligatoriska regler för att användarens data aldrig går förlorad i MyNutrition (Fettförbränningsveckan). Använd ALLTID innan du ändrar något i public/ eller släpper en ny version: lagringsnycklar, dataformat, migreringar, export/import, service worker, cache, villkor, borttagna funktioner eller råd till användaren om att rensa något i webbläsaren.
---

# Datakompatibilitet: användarens data får aldrig försvinna

All data finns bara i användarens webbläsare (IndexedDB, localStorage som reserv). Det finns ingen server och ingen
kopia. Försvinner något vid en uppdatering är det borta för alltid. Därför gäller:

**Varje ny version ska kunna läsa all data som någon tidigare version har sparat eller exporterat, och ingen
uppdatering får ta bort, tömma eller skriva över användarens data.**

## Regler

1. **Nycklar är eviga.** En lagringsnyckel (`ffv`, `ffv-log`, `ffv-myrecipes` …) byter aldrig namn och tas aldrig bort
   så länge den kan innehålla användardata. Nya nycklar läggs till; gamla finns kvar.
2. **Format ändras bara bakåtkompatibelt.**
   - Lägg till fält; ta inte bort eller byt betydelse på befintliga fält.
   - Måste formatet ändras: läs det gamla formatet för alltid, översätt när det läses (`clean…`-funktionerna) och
     skriv det nya först när översättningen har lyckats. Den gamla datan tas bort först när den nya är sparad.
   - Nya `clean…`-funktioner ska behålla okända fält i stället för att rensa bort dem (en nyare version kan ha
     skrivit dem). Äldre `clean…`-funktioner gör inte det ännu; ändra dem när de ändå berörs.
3. **Ingen radering vid start.** Startkoden (`app.js` → `start()`, modulernas `load…`) får aldrig anropa `remove`,
   `clearAll`, `eraseAll` eller spara tomma värden över befintliga. Enda undantag är dokumenterade flyttar av äldre
   format med eget test (t.ex. `ffv-shop-<vecka>` → `ffv-shop`). All radering ska kräva ett aktivt val av användaren
   med bekräftelse (Radera all data, Rensa mina uppgifter).
4. **Export och import.** Alla gamla exportfiler (format 1, 2 …) ska alltid gå att läsa in. Höj formatversionen när
   formatet ändras och behåll läsningen av de äldre. All användardata ska följa med i exporten; det som bara gäller
   enheten listas i `DEVICE_ONLY` i `backup.js`. Import ska aldrig skriva över utan att användaren har sett vad som
   ersätts och bekräftat det.
5. **Villkor.** Att höja `TERMS_VERSION` får bara visa villkoren igen; datan ska ligga kvar (testas i `reload.mjs`).
6. **Service worker och cache** rör aldrig IndexedDB eller localStorage. Rensning av cache (sw.js, `ffvClearCache`,
   laddningsskärmen) får bara ta bort app-filer.
7. **Borttagna funktioner.** Tas en funktion bort ligger dess användardata kvar orörd. Bara data som uppenbart inte är
   användarens (t.ex. inställningar för en borttagen timer) får tas bort, och det ska stå i CHANGELOG.md.
8. **Råd till användaren.** Föreslå ALDRIG "Clear site data", "Rensa webbplatsdata", "Rensa cookies och
   webbplatsdata" eller att avinstallera appen; det raderar all data. Föreslå bara att tömma *cachade bilder och
   filer*, ett inkognitofönster eller laddningsskärmens "Rensa cache och ladda om" (behåller data). Om något
   ändå kan riskera data: be användaren exportera allt först (Inställningar → Säkerhetskopia och delning).
9. **iPhone och iPad:** appen på hemskärmen har egen lagring, skild från Safari och Chrome. Data "försvinner" inte
   men finns i den andra. Hänvisa till export i den ena och import i den andra.

## Före varje ny version (checklista)

1. Ny eller ändrad nyckel/format? Uppdatera nyckeltabellen i `docs/ARCHITECTURE.md` och bestäm om den hör till
   exporten eller `DEVICE_ONLY`.
2. Lägg till en ögonblicksbild av sparad data för den nya versionen: `tests/fixtures/data-<version>.json` med varje
   nyckel ifylld med realistisk data (alla fält, även valfria). **Ändra eller ta aldrig bort äldre fixturer** – de
   bevisar att data från de versionerna fortfarande läses in.
3. Ändrades ett format: lägg till ett test i `tests/reload.mjs` eller `tests/run.mjs` som läser det gamla formatet
   och visar att inget går förlorat.
4. Kör `bun tests/run.mjs`. Testet "Ingen sparad data ändras vid start" och "Inga sparade nycklar försvinner" ska
   gå igenom för varje fixtur. Ett fel här stoppar releasen; lös det i koden, inte genom att ändra fixturen.
5. Höj versionen (`npm run bump -- patch|minor`) och skriv i CHANGELOG.md, även om data flyttas eller översätts.

## Om data ändå har försvunnit

- Ta reda på var: annan enhet, webbläsaren kontra appen på hemskärmen, inkognito, eller rensad webbplatsdata.
- Finns datan kvar någonstans: exportera där och importera i den andra.
- Leta i koden efter radering eller överskrivning vid start och lägg till ett test som återskapar felet innan du rättar.
