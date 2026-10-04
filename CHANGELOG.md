# Ändringslogg

Alla viktiga ändringar i appen. Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och
versionerna [semantisk versionshantering](https://semver.org/lang/sv/). Före 1.0.0 är appen under utveckling:
MINOR höjs för nya funktioner, PATCH för rättningar. Höj versionen med `npm run bump -- patch|minor|major`.

## [Ej släppt]

## [0.2.0] - 2026-10-04

### Tillagt
- Inköpslistan har en egen veckoväljare under Mat → Handla, oberoende av Veckan.
- Inställningar → Inköpslista: välj att inköpslistan alltid visar nästa vecka, för den som handlar helgen före.

## [0.1.0] - 2026-10-04

Första numrerade versionen. Innehåller det som byggts hittills:

### Tillagt
- Veckomeny efter säsong och allergier, skalad efter kalorimålet, med inköpslista som går att bocka av.
- Träningsprogram för gym, hantlar eller kroppsvikt, med övningar som byts enligt valt intervall.
- Fasta 16:8 med ätfönster räknat från den första måltiden.
- Logg med vikt, midja, konditionspass, intensitetsminuter och mående, samt rapport för utskrift och PDF.
- Egna livsmedel, egna recept i hushållsmått och egna tillskott.
- Plankod för att dela recept och träningsprogram med andra.
- Export och import av allt, som fil eller text.
- Guide första gången, med villkor som måste godkännas innan något sparas.
- Installerbar webbapp som fungerar offline.
- Versionsnumret visas i sidfoten och under Om appen.

### Ändrat
- Inställningarna är uppdelade i undersidor.
- Egna ingredienser i egna recept kommer med i inköpslistan.
- Ananas står som "färsk (ej konserverad)": i konserver har värmen förstört enzymet bromelain.

### Rättat
- Radera all data tömmer databasen även när den är öppen i en annan flik (Safari på iPhone), och rensar också
  webbappens cache.
- Ny HTML blandas inte längre med gamla JavaScript-filer efter en uppdatering (Cache-Control: no-cache).
