# Så hänger appen ihop

En statisk webbapp utan byggsteg: `public/index.html`, en stilmall och JavaScript-moduler som laddas direkt i
webbläsaren. Allt körs lokalt; inget skickas till någon server.

## Lager

```
data/        Fakta: livsmedel, recept, övningar. Bara konstanter.
*.js         Domän: beräkningar och sparad data (nutrition, menu, training, log, preferences, myrecipes,
             supplements, plancode, backup, storage). Läser aldrig från sidan, så de går att testa fristående.
views/       Ritar HTML från färdiga data (render…-funktioner). Kopplar inga händelser.
controllers/ Kopplar knappar och formulär till domänen och ber appen rita om.
app.js       Profilen, update() som ritar om allt, och starten.
main.js      Startpunkt: väntar på lagring, stilmall och typsnitt och laddar sedan app.js.
```

Regel: en modul får bara importera från lager ovanför sig i listan (views importerar inte controllers osv.).
Controllers som behöver rita om får `update` skickad till sig via sin `init…()`-funktion i stället för att
importera `app.js`, så att det inte blir cirkulära importer.

## Start

1. `index.html` visar en laddningsskärm (`html.booting`). Skriptet där laddar om automatiskt om starten misslyckas;
   försök 2 och 3 tömmer också cachen (data finns kvar). Knapparna för att rensa visas efter tre misslyckanden
   eller 60 sekunder.
2. `index.html` laddar `js/main.js?v=<version>`, så att startfilen alltid är den nya. Styrs sidan inte av service
   workern (första besöket, eller efter Radera all data) kontrollerar `main.js` först alla app-filer mot servern,
   en gång per session och version, så att gamla filer i webbläsarens cache inte blandas med den nya sidan.
   Därefter väntar `main.js` på `initStorage()`, stilmallen och typsnitten (högst 2 s) och importerar `app.js`.
3. `app.js` läser in sparad data, kopplar controllers (`initSettingsForms`, `initLogForm`, `initBackupForms`) och:
   - har profil och godkända villkor: `start()`
   - har profil men inte nuvarande villkor: guiden visar bara villkoren
   - ny användare: hela guiden (`wizard.js`); inget sparas förrän den är klar.
4. `start()` ritar allt (`update()`) och startar navigeringen (`initNavigation`).

## Lagring

`storage.js` läser in allt i minnet vid start; `load`/`save` är synkrona och skrivningar går till IndexedDB i
bakgrunden (localStorage som reserv). **Inget skrivs innan villkoren är godkända**: lagringen är låst tills
`unlockStorage()` anropas från `acceptTerms()` i `app.js`. Höj `TERMS_VERSION` när villkoren ändras i sak.

| Nyckel | Innehåll | Modul |
| --- | --- | --- |
| `ffv` | Profilen ({ fältets id: värde }, bl.a. eget kalorimål `kcal`) | app.js |
| `ffv-terms` | Godkända villkor (gäller bara enheten) | app.js |
| `ffv-log` | Loggposter (vikt, pass, anteckning, ersatta måltider `swaps`, avbockade måltider `eaten`, mellanmål `snacks` från 0.21.0, ätit `intakeK`/`intakeP` och bränt `burned` (kcal) från 0.22.0 …; okända fält behålls) | log.js |
| `ffv-excl` | Allergier, bortvalda livsmedel och ord | preferences.js |
| `ffv-myfoods`, `ffv-myrecipes`, `ffv-mysupps` | Egna livsmedel, recept och tillskott | preferences.js, myrecipes.js, supplements.js |
| `ffv-supps` | Valda tillskott | supplements.js |
| `ffv-seed`, `ffv-salt`, `ffv-tseed` | Slumpfrön för meny och träning (plankoden) | menu.js |
| `ffv-shop` | Avbockat i inköpslistan, gäller alla veckor | app.js |
| `ffv-shop-next` | Inköpslistan visar alltid nästa vecka | app.js |
| `ffv-schedule` | Veckoschema: egna tider för gympass, intervaller, promenad och egna aktiviteter per veckodag (`days`, med valt gympass i `session` från 0.15.0), egna aktiviteter och pass i `extra` (`[{ label, from, to, hard? }]`, `hard: true` = hårt pass som CrossFit från 0.20.0) och arbetstid (`work`); passupplägg i `split` (`"full"` = helkropp varje pass, saknas = appens förslag) från 0.18.0 | schedule.js |
| `ffv-traintimes` | Egna träningstider från 0.8.0 (läses fortfarande som förslag, skrivs inte längre) | trainingtimes.js |
| `ffv-moves` | Måltider som bytt plats mellan dagar, per vecka | menu.js |
| `ffv-trainmoves` | Gympass som flyttats en enskild vecka (t.ex. vid förhinder): `{ vecka: [[frånDag, tillDag], …] }` (från 0.16.0) | schedule.js |
| `ffv-goals` | Mål för konditionen per aktivitet, först löpning: `{ lopning: { weekKm, weekRuns, distKm, timeS } }` (alla valfria), från 0.19.0 | goals.js |
| `ffv-meals` | Efterrätt vilka veckodagar, tillbehör vilka veckodagar (`sideDays`), fuskdag (`cheatDay`) med godis, billiga råvaror (`cheap`) och valda billigare råvaror (`swaps`) | preferences.js |
| `ffv-mealswaps` | Senast använda ersättningar för måltider (snabbval) | log.js |
| `ffv-workout` | Pågående gympass (bara för enheten, överlever en omladdning) | controllers/workout.js |
| `ffv-install-declined`, `ffv-swipe-hint` | Bara för enheten | pwa.js, navigation.js |
| `ffv-lastexport`, `ffv-backup-snooze` | Senaste export och påminnelsen om säkerhetskopia (bara för enheten) | controllers/backup-form.js |

Allt utom det som bara gäller enheten följer med i exporten (`backup.js`). En ny nyckel som ska följa med
behöver läggas till där, och testas i `tests/backup.mjs`.

## Dataflöde

All visning går genom `update()` i `app.js`: läs profilen från formuläret → räkna mål (`nutrition.js`) →
bygg vecka och träning (`menu.js`, `training.js`) → anropa varje vys `render…()`. En ändring sparar sitt och
anropar `update()`; ingen vy uppdateras för sig. Det är enkelt och tillräckligt snabbt.

## Navigering

`controllers/navigation.js`. Adressens `#` styr vad som visas:

- `#idag`, `#mat`, … visar en flik (`<div class="view" data-view="…">`).
- En länk till ett element (`#backup`, `#rc-…`) öppnar fliken det ligger i och scrollar dit.
- Mat har underflikar (`data-subview`).
- Inställningar är en meny (`#installningar-meny`) med undersidor (`data-page`).

### Ny undersida under Inställningar

1. I `index.html`, i vyn `installningar`: lägg till
   ```html
   <div class="settings-page" data-page="namn" hidden>
     <a class="back-link" href="#installningar">‹ Inställningar</a>
     <section id="…">…</section>
   </div>
   ```
2. Lägg till en rad i `<nav class="settings-menu">` med `href="#namn"`.
3. Händelser kopplas i `controllers/settings-forms.js` (eller en ny controller med en `init…()` som anropas i
   `app.js`). Ingen ändring behövs i navigeringen.

## Pass som loggas direkt

Gympass (`controllers/workout.js`) loggas när de avslutas, via `addWorkout()` i `log.js`: en rad i dagens
anteckning och "tränat". Knappar med `data-edit-log` öppnar dagens post i loggen (`openLogFor` i
`controllers/log-form.js`), så att användaren kan ändra eller lägga till.

## Sidan scrollar aldrig

Bara appens innehåll (`.views`) och guiden scrollar. Använd `scrollToElement()` i `util.js`, aldrig
`el.scrollIntoView()`, som även scrollar sidan; då blir appen kvar uppskjuten, särskilt på iPhone när tangentbordet
stängs. `controllers/inputs.js` flyttar tillbaka sidan om den ändå har scrollats.

## Formulärfält

`controllers/inputs.js` ger alla fält sitt beteende via attribut: `data-decimal` (komma eller punkt),
`data-clock` (HH:MM, 24 h) och `data-info` (informationsikon med `aria-controls`). Textfält ska ha minst 16 px
text, annars zoomar iPhone in.

## Svenska format

Datum ÅÅÅÅ-MM-DD, 24-timmarsklocka, måndag först och decimalkomma. Använd hjälpfunktionerna i `util.js`
(`todayStr`, `svDate`, `num`, `fmt`) i stället för webbläsarens standardformat.

## Användarens data får aldrig försvinna

Följ skillen `datakompatibilitet` (`.claude/skills/datakompatibilitet/SKILL.md`). Kort: nycklar och format ändras bara
bakåtkompatibelt, inget raderas vid start, gamla exporter går alltid att läsa, och varje version får en
ögonblicksbild av sparad data i `tests/fixtures/data-<version>.json` som testerna startar appen med.

## Ändra och publicera

- Höj versionen efter varje ändring med `npm run bump -- patch|minor` (semver, se README) och skriv i
  `CHANGELOG.md`. Versionen ger service workern en ny cache, annars kan installerade appar ladda gamla filer.
- En ny fil i `public/js/` måste in i `CORE` i `public/sw.js` (testerna kontrollerar det).
- Kör `npm test` (alla rader ska vara `OK`).
- Alla filer är UTF-8 (`.editorconfig`, `public/_headers`).
- Bun 1.1.21 har ett fel där en mallsträng med å/ä/ö följd av `+` och en mallsträng med `${}` tappar resten
  av uttrycket. Bygg sådana strängar med `[…].join("")`, eller uppgradera bun.
