# Fettförbränningsveckan

En personlig veckoplan för viktnedgång som fungerar som installerbar webbapp (PWA) på mobil och dator.

- **Kalorimål och makron** räknade med Harris-Benedict eller Katch-McArdle (enligt ExRx), med lågt fett och högt protein.
- **Träningsprogram** med övningar från ExRx övningskatalog: helkropp, överkropp och ben (3 dagar) eller över/under (4 dagar), med varierad och intensiv bålträning.
- **Säsongsrecept**: färska svenska grönsaker efter årstid, ren- och älgskav, vit fisk (lax som alternativ). Menyn roterar varje vecka utan upprepning.
- **Periodisk fasta 16:8** med frukost och en eftermiddagsmåltid, lördagsgodis och en fri måltid.
- **Logg och statistik**: målvikt, vikt, midja, mående, prestation och testtid, med viktkurva, takt och prognos. Export och import av allt, som fil eller som text att klistra in.
- **Allergier och bortval**: kryssa i allergener och enskilda livsmedel; recepten byter ut, stryker eller tar bort det som inte passar.
- **Egna livsmedel** med näringsvärden per 100 g, som ersättare i recepten.
- **Inköpslista att bocka av**, sorterad efter avdelning i butiken.
- **Plankod** att dela: samma kod ger samma rätter och samma övningar vecka för vecka, med portioner efter var och ens profil.
- **Varierad träning**: passen är alltid helkropp, överkropp och ben, men övningarna växlar varje, varannan eller var fjärde vecka.
- **Fastan i dag**: fyll i när du faktiskt åt, så räknas ätfönster, nästa måltid och nästa dags fasta om. Fastetiden loggas per natt.
- **Mina recept**: egna recept, till exempel en egen frukost varje dag.
- **Tillskott**: tips om när PWO, vassle och kreatin passar in i dagen.

Allt körs i webbläsaren. Inga uppgifter skickas till någon server.

Appen ger **rekommendationer baserade på ExRx.net, inte medicinsk rådgivning**. Första gången visas villkoren (rekommendationer, eget ansvar, hur data hanteras, i befintligt skick) och måste godkännas; de finns sedan under **Om appen** (`#om`, `#villkor`). Godkännandet sparas per enhet i `ffv-terms`; höj `TERMS_VERSION` i `public/js/app.js` när villkoren ändras, så får alla godkänna dem igen.

Källkoden är licensierad under MIT-licensen (se `LICENSE`). Licensen gäller koden, inte material från ExRx.net.

## Filer

```
public/index.html            Sidans HTML: flikarna Idag, Mat, Träning, Logg, Profil och Inställningar
public/guide.html            Förklaringar till alla val och beräkningar
public/css/app.css           Stilmall (färger, komponenter, vyer)
public/js/backup.js          Export och import av allt sparat (fil eller text), även äldre exporter
public/js/main.js            Startpunkt: läser in lagringen och startar appen
public/js/storage.js         Lagring: IndexedDB, med localStorage som reserv
public/js/app.js             Styrning: profilen, update() som ritar om allt, plankod, Mat, fastan och starten
public/js/controllers/       Knappar och formulär per område: navigation (flikar, undersidor, svep), inputs
                             (sifferfält, klockslag, info-ikoner), log-form, backup-form, settings-forms
public/js/util.js            Hjälpfunktioner: DOM, talformat, lagring, datum, slump som går att upprepa
public/js/nutrition.js       Energibehov, makromål och skalning av portioner
public/js/preferences.js     Allergier, bortvalda ingredienser och egna livsmedel
public/js/menu.js            Säsong, anpassning efter allergier, veckorotation, skalade recept, inköpslista
public/js/plancode.js        Plankoden som gör planen delbar (receptfrö, träningsfrö, träningsupplägg)
public/js/day.js             Dagens tider (måltider, träning) räknat från frukost
public/js/fasting.js         Fastan: ätfönster, nästa måltid och läget just nu från verkliga måltidstider
public/js/myrecipes.js       Egna recept
public/js/supplements.js     Tips om PWO, vassle och kreatin
public/js/training.js        Träningsprogram och vilka dagar passen läggs
public/js/log.js             Loggposter och statistik
public/js/pwa.js             Offline, beständig lagring och förslaget att installera appen
public/js/wizard.js          Guiden första gången: profilen steg för steg innan något sparas
public/js/data/foods.js      Livsmedel, butiksavdelningar, allergener och ersättare
public/js/data/recipes.js    Recept och säsongsråvaror
public/js/data/exercises.js  Övningar från ExRx
public/js/views/*.js         En fil per vy som ritar HTML (today, food, training-view, log-view, profile, settings)
tests/run.mjs                Tester: beräkningarna och hela appen i en simulerad webbläsare
tests/storage.mjs            Lagringstest: IndexedDB, flytt från localStorage, reserv och radering
tests/reload.mjs             Uppdateringstest: startar om appen med sparad data och kontrollerar att inget försvinner
public/manifest.webmanifest  App-manifest (namn, ikoner, färger)
public/sw.js                 Service worker för offline och installation
public/icons/                Appikoner
.claude/skills/exrx/         Claude Code-skill som hämtar fakta från exrx.net
tests/backup.mjs             Importtest: guiden, skriva över med varning och äldre exporter, i en ren webbläsare
wrangler.jsonc               Cloudflare-konfiguration: publicerar public/ som statisk sida
```

Beräkningarna (`nutrition.js`, `menu.js`, `training.js`, `log.js`) läser aldrig från sidan, så de går att testa och ändra utan att röra vyerna. Vyerna i `public/js/views/` tar färdiga data och ritar HTML. `app.js` och `public/js/controllers/` binder ihop dem.

Mer om hur appen hänger ihop (start, lagring, dataflöde, hur man lägger till en vy eller inställning) finns i [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Vanliga ändringar

- **Nytt recept:** lägg till det i `public/js/data/recipes.js`. Ingredienser som ska följa säsongen skrivs som `@plats` (se `SEASONAL`).
- **Nytt livsmedel:** lägg till det i `FOOD` i `public/js/data/foods.js` och i rätt butiksavdelning i samma fil.
- **Ny övning:** lägg till den i `public/js/data/exercises.js` och använd den i `buildSessions` i `public/js/training.js`.
- **Ny undersida under Inställningar:** se [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#ny-undersida-under-inställningar).
- **Ny fil i `public/js/` eller `public/css/`:** lägg till den i listan `CORE` i `public/sw.js`, annars fungerar den inte offline.
- **Efter varje ändring:** höj versionen med `npm run bump -- patch` (rättning) eller `minor` (ny funktion), skriv vad som ändrats i `CHANGELOG.md` och kör testerna. Se [Versioner](#versioner).

## Köra lokalt

Appen använder JavaScript-moduler, så den måste köras från en webbserver (inte genom att öppna filen direkt):

```bash
cd /mnt/nvme/MyNutrition
npm start                      # eller: python3 scripts/serve.py 8000 public
```

`scripts/serve.py` är som `python3 -m http.server`, men säger åt webbläsaren att alltid kontrollera om en fil har ändrats (`Cache-Control: no-cache`) och anger UTF-8 för textfiler. Med den vanliga `http.server` kan webbläsaren återanvända en gammal kopia av en JavaScript-fil efter en ändring, och då blandas gamla och nya filer ("doesn't provide an export named …").

Öppna http://localhost:8000.

## Tester

```bash
npm install     # en gång, installerar jsdom och fake-indexeddb (bara för testerna)
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

Höj versionen (se [Versioner](#versioner)) när du ändrar filerna. Den nya versionen ger service workern en ny cache, så installerade appar hämtar de nya filerna och den gamla cachen rensas.

## Versioner

Appen numreras enligt [semantisk versionshantering](https://semver.org/lang/sv/), `MAJOR.MINOR.PATCH`. Före 1.0.0 är
appen under utveckling: **MINOR** höjs för nya funktioner (och för ändringar som inte är bakåtkompatibla), **PATCH**
för rättningar. 1.0.0 blir den första releasen.

```bash
npm run bump -- patch     # 0.1.0 -> 0.1.1
npm run bump -- minor     # 0.1.0 -> 0.2.0
```

Skriptet (`scripts/version.py`) uppdaterar `package.json`, `public/js/version.js` och `public/sw.js` och lägger en
rubrik för versionen i [CHANGELOG.md](CHANGELOG.md). Versionen visas i sidfoten och under Om appen och följer med i
exporten. Testerna kontrollerar att de tre filerna har samma version.

## Data

### Användardata vid uppdateringar

Profil, logg, plankod, allergival, egna livsmedel och recept sparas i webbläsarens IndexedDB (databasen `fettforbranning`), med localStorage som reserv om IndexedDB saknas, under nycklar som börjar på `ffv`. Data från äldre versioner flyttas automatiskt från localStorage till IndexedDB vid start (`public/js/storage.js`). En ny version av appen (`npm run bump`) byter bara filerna i cachen; den sparade datan rörs inte. Därför gäller vid varje ändring:

- **Byt aldrig namn på en nyckel** (`ffv`, `ffv-log`, `ffv-seed`, `ffv-tseed`, `ffv-salt`, `ffv-excl`, `ffv-myfoods`, `ffv-myrecipes`, `ffv-supps`, `ffv-shop-*`) och ändra inte formatet utan att läsa in det gamla formatet också.
- **Nya fält ska ha ett standardvärde**, så att sparade profiler utan fältet fungerar.
- `npm test` kör `tests/reload.mjs`, som startar om appen med sparad data, både den aktuella och ett äldre format, och kontrollerar att inget försvinner eller skrivs om.

Lagringen hör till webbadressen. `gym.jonzzon.nu`, en `*.workers.dev`-adress och `localhost:8000` har var sin lagring. Appen ber om beständig lagring (`navigator.storage.persist()`), så att webbläsaren inte rensar den när utrymmet blir trångt.

**iPhone:** En app som lagts på hemskärmen har egen lagring, skild från Safari. Uppgifter som fyllts i i Safari följer inte med; fyll i profilen i appen, eller flytta dem med **Kopiera allt** i Safari och klistra in texten i guidens första steg i appen. Safari kan radera data för webbplatser som inte besökts på 7 dagar, men det gäller inte appar på hemskärmen.

- Inställningar, allergival, egna livsmedel, avbockningar, logg och omslumpade veckor sparas i webbläsarens IndexedDB (localStorage som reserv) på varje enhet.
- Under **Inställningar → Säkerhetskopia och delning**: **Exportera allt** (fil) och **Kopiera allt** (text) tar med allt sparat: profil, logg, plankod och frön, allergier och bortval, egna livsmedel och recept, tillskott och avbockningar (`public/js/backup.js`). Bara det som gäller enheten (svep-tipset, avböjd installation) stannar kvar.
- **Import** av fil eller inklistrad text ersätter allt som är sparat på enheten, efter en varning om det redan finns data. Sidan laddas sedan om. Äldre exporter (version 1) läses också. Guiden erbjuder import som första steg.
- **Radera all data** under Inställningar raderar allt appen har sparat, även godkännandet av villkoren, efter en bekräftelse. Appen börjar sedan om med villkoren.

## Källor

Beräkningar och träningsprinciper bygger på [ExRx.net](https://exrx.net/). Se `guide.html` för detaljer och länkar. Näringsvärdena är uppskattningar; exakta värden finns i [Livsmedelsverkets livsmedelsdatabas](https://soknaringsinnehall.livsmedelsverket.se/).

Planen är för friska vuxna. Rådfråga läkare eller dietist vid graviditet, diabetes, hjärt-kärlsjukdom, njursjukdom, ätstörning eller medicinering.
