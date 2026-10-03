# Fettförbränningsveckan

En personlig veckoplan för viktnedgång som fungerar som installerbar webbapp (PWA) på mobil och dator.

- **Kalorimål och makron** räknade med Harris-Benedict eller Katch-McArdle (enligt ExRx), med lågt fett och högt protein.
- **Träningsprogram** med övningar från ExRx övningskatalog: helkropp, överkropp och ben (3 dagar) eller över/under (4 dagar), med varierad och intensiv bålträning.
- **Säsongsrecept för Norrland**: färska svenska grönsaker, ren- och älgskav, vit fisk (lax som alternativ). Menyn roterar varje vecka utan upprepning.
- **Periodisk fasta 16:8** med frukost och en eftermiddagsmåltid, lördagsgodis och en fri måltid.
- **Logg och statistik**: målvikt, vikt, midja, mående, prestation och testtid, med viktkurva, takt och prognos. Export och import som JSON.
- **Allergier och bortval**: kryssa i allergener och enskilda livsmedel; recepten byter ut, stryker eller tar bort det som inte passar.
- **Egna livsmedel** med näringsvärden per 100 g, som ersättare i recepten.
- **Inköpslista att bocka av**, sorterad efter avdelning i butiken.
- **Plankod** att dela: samma kod ger samma rätter och samma övningar vecka för vecka, med portioner efter var och ens profil.
- **Varierad träning**: passen är alltid helkropp, överkropp och ben, men övningarna växlar varje, varannan eller var fjärde vecka.
- **Fastan i dag**: fyll i när du faktiskt åt, så räknas ätfönster, nästa måltid och nästa dags fasta om. Fastetiden loggas per natt.
- **Mina recept**: egna recept, till exempel en egen frukost varje dag.
- **Tillskott**: tips om när PWO, vassle och kreatin passar in i dagen.

Allt körs i webbläsaren. Inga uppgifter skickas till någon server.

## Filer

```
public/index.html            Sidans HTML: flikarna Idag, Mat, Träning, Logg, Profil och Inställningar
public/guide.html            Förklaringar till alla val och beräkningar
public/css/app.css           Stilmall (färger, komponenter, vyer)
public/js/app.js             Styrning: läser profilen, ritar om, kopplar knappar och formulär, flikar, PWA
public/js/util.js            Hjälpfunktioner: DOM, talformat, lagring, datum, slump som går att upprepa
public/js/nutrition.js       Energibehov, makromål och skalning av portioner
public/js/preferences.js     Allergier, bortvalda ingredienser och egna livsmedel
public/js/menu.js            Säsong, anpassning efter allergier, veckorotation, skalade recept, inköpslista
public/js/plancode.js        Plankoden som gör planen delbar (frö, omslumpade veckor, träningsupplägg)
public/js/day.js             Dagens tider (måltider, träning) räknat från frukost
public/js/fasting.js         Fastan: ätfönster, nästa måltid och läget just nu från verkliga måltidstider
public/js/myrecipes.js       Egna recept
public/js/supplements.js     Tips om PWO, vassle och kreatin
public/js/training.js        Träningsprogram och vilka dagar passen läggs
public/js/log.js             Loggposter, statistik och synk till claude-kontot
public/js/data/foods.js      Livsmedel, butiksavdelningar, allergener och ersättare
public/js/data/recipes.js    Recept och säsongsråvaror
public/js/data/exercises.js  Övningar från ExRx
public/js/views/*.js         En fil per vy som ritar HTML (today, food, training-view, log-view, profile, settings)
tests/run.mjs                Tester: beräkningarna och hela appen i en simulerad webbläsare
public/manifest.webmanifest  App-manifest (namn, ikoner, färger)
public/sw.js                 Service worker för offline och installation
public/icons/                Appikoner
.claude/skills/exrx/         Claude Code-skill som hämtar fakta från exrx.net
wrangler.jsonc               Cloudflare-konfiguration: publicerar public/ som statisk sida
```

Beräkningarna (`nutrition.js`, `menu.js`, `training.js`, `log.js`) läser aldrig från sidan, så de går att testa och ändra utan att röra vyerna. Vyerna i `public/js/views/` tar färdiga data och ritar HTML. `app.js` binder ihop dem.

### Vanliga ändringar

- **Nytt recept:** lägg till det i `public/js/data/recipes.js`. Ingredienser som ska följa säsongen skrivs som `@plats` (se `SEASONAL`).
- **Nytt livsmedel:** lägg till det i `FOOD` i `public/js/data/foods.js` och i rätt butiksavdelning i samma fil.
- **Ny övning:** lägg till den i `public/js/data/exercises.js` och använd den i `buildSessions` i `public/js/training.js`.
- **Ny fil i `public/js/` eller `public/css/`:** lägg till den i listan `CORE` i `public/sw.js`, annars fungerar den inte offline.
- **Efter varje ändring:** höj `VERSION` i `public/sw.js` och kör testerna.

## Köra lokalt

Appen använder JavaScript-moduler, så den måste köras från en webbserver (inte genom att öppna filen direkt):

```bash
cd /mnt/nvme/MyNutrition
python3 -m http.server 8000 -d public
```

Öppna http://localhost:8000.

## Tester

```bash
npm install     # en gång, installerar jsdom
npm test
```

Testerna kontrollerar bland annat kalorimålen, att två veckor i följd aldrig delar rätt, att tomat, gurka och paprika bara kommer på sommaren, att allergier tar bort rätt livsmedel och att gymdagarna fördelas rätt. Sedan körs hela appen i en simulerad webbläsare: flikarna, receptlänkarna, profilen, allergifiltret, egna livsmedel, loggen och inköpslistan.

## Installera på mobilen

En PWA måste öppnas från en **https-adress** för att kunna installeras. Sidan publiceras som statisk sida på Cloudflare; `wrangler.jsonc` pekar på katalogen `public/`, så bara den publiceras.

```bash
npx wrangler deploy
```

Eller koppla repot i Cloudflare-panelen (**Workers & Pages → Create → Import a repository**) med deploy-kommandot `npx wrangler deploy` och inget build-kommando.

Öppna adressen du får (till exempel `https://mynutrition.<ditt-konto>.workers.dev/`) på mobilen.
- **Android (Chrome):** tryck på *Installera appen* på sidan, eller menyn ⋮ → *Installera app*.
- **iPhone (Safari):** dela-knappen → *Lägg till på hemskärmen*.

Alla sökvägar är relativa, så appen fungerar även i en undermapp som GitHub Pages använder.

## Uppdatera appen

Höj `VERSION` i `public/sw.js` (till exempel från `ffv-v7` till `ffv-v8`) när du ändrar filerna. Då hämtar installerade appar de nya filerna och rensar den gamla cachen.

## Data

- Inställningar, allergival, egna livsmedel, avbockningar, logg och omslumpade veckor sparas i webbläsarens `localStorage` på varje enhet.
- **Exportera JSON** sparar loggen, målvikten, inställningarna, allergivalen och dina egna livsmedel. **Importera JSON** läser in dem igen och slår ihop loggposterna per datum. Använd det för att flytta data mellan enheter och som säkerhetskopia.
- I versionen som publiceras på claude.ai sparas loggen även privat i användarens claude-konto.

## Källor

Beräkningar och träningsprinciper bygger på [ExRx.net](https://exrx.net/). Se `guide.html` för detaljer och länkar. Näringsvärdena är uppskattningar; exakta värden finns i [Livsmedelsverkets livsmedelsdatabas](https://soknaringsinnehall.livsmedelsverket.se/).

Planen är för friska vuxna. Rådfråga läkare eller dietist vid graviditet, diabetes, hjärt-kärlsjukdom, njursjukdom, ätstörning eller medicinering.
