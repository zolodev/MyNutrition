# Ändringslogg

Alla viktiga ändringar i appen. Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och
versionerna [semantisk versionshantering](https://semver.org/lang/sv/). Före 1.0.0 är appen under utveckling:
MINOR höjs för nya funktioner, PATCH för rättningar. Höj versionen med `npm run bump -- patch|minor|major`.

## [Ej släppt]

## [0.8.0] - 2026-10-06

### Tillagt
- Egna träningstider per veckodag under Profil → Träningstider, t.ex. 16:00–18:00 tisdag och torsdag men
  11:00–13:00 lördag. Idag (tidslinjen och tillskottstipsen) och veckoschemat följer tiderna.
- Byt plats på måltider mellan dagar under Mat → Veckan, med Återställ.
- När en måltid ersätts (t.ex. med Huel) kan den planerade rätten flyttas till en annan dag i veckan; Idag visar vad
  som ersattes och vart det flyttades, och Ångra flyttar tillbaka den.

## [0.7.0] - 2026-10-06

### Borttaget
- Hemmapass med intervalltimer ("Utan vikter") under Träning, eftersom den inte fungerade i Chrome. Gympassen kan
  fortfarande startas i appen och loggas direkt. Sparade inställningar för timern (`ffv-timer`) tas bort vid start.

## [0.6.1] - 2026-10-06

### Rättat
- Guiden kunde fastna på första steget (Nästa gick inte att trycka på) när webbläsaren blandade den nya sidan med en
  gammal guide ur sin cache, t.ex. direkt efter Radera all data. Startfilen laddas nu med versionen i adressen
  (`js/main.js?v=…`), och utan service worker kontrolleras alla app-filer mot servern innan appen startar.

## [0.6.0] - 2026-10-06

### Tillagt
- Välkomststeg först i guiden, före villkoren: vad appen är och att den kan installeras på mobilen eller datorn,
  med en knapp för att installera och instruktioner för webbläsaren. Visar att appen redan är installerad när den är det.

## [0.5.2] - 2026-10-06

### Tillagt
- Information om medicin (t.ex. Alvedon och Ipren) under fastan och träningen: en regel under Fastan i appen och
  ett avsnitt i förklaringarna.

## [0.5.1] - 2026-10-06

### Ändrat
- Kreatin och PWO går bra att ta samtidigt. Texten avrådde tidigare utifrån en äldre studie som senare forskning inte
  har bekräftat; nu nämns bara att kreatinet kan tas efter passet om kombinationen ger magbesvär.

## [0.5.0] - 2026-10-05

### Tillagt
- Huels produkter som snabbval när en måltid ersätts: Powder, Black Edition, Ready-to-drink, Black Edition
  Ready-to-drink, Hot & Savoury, Complete Nutrition Bar och Complete Protein (värden per måltid enligt huel.com).

## [0.4.0] - 2026-10-05

### Tillagt
- Ersätt en måltid på Idag ("Åt du något annat?"), t.ex. en Huel-shake i stället för eftermiddagsmåltiden. Dagens
  kalorier och protein räknas om, ersättningen sparas i loggen och senast använda ersättningar blir snabbval.
- Test för att byta "Varje runda" i hemmapasset åt båda hållen.

## [0.3.0] - 2026-10-04

### Tillagt
- Hemmapass med intervalltimer under Träning: färdiga pass (100 burpees på 20 minuter, Tabata, kroppsviktscirkel)
  eller eget, med justerbara rundor, repetitioner, vila och tidsgräns. Pip, vibration och skärmen hålls tänd.
  Vilan kan förlängas eller kortas med 10 s medan passet pågår.
- Gympassen i programmet kan startas i appen med en klocka som överlever en omladdning.
- Pass loggas direkt när de avslutas (anteckning, tid och intensitetsminuter), och "Ändra i loggen" öppnar dagens
  post för att ändra eller lägga till.

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
