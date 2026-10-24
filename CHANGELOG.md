# Ändringslogg

Alla viktiga ändringar i appen. Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och
versionerna [semantisk versionshantering](https://semver.org/lang/sv/). Före 1.0.0 är appen under utveckling:
MINOR höjs för nya funktioner, PATCH för rättningar. Höj versionen med `npm run bump -- patch|minor|major`.

## [Ej släppt]

## [0.19.0] - 2026-10-24

### Tillagt
- Löpmål under Logg: veckomål i kilometer och antal pass (måndag–söndag) med framsteg för veckan och de senaste
  veckorna, och ett tidsmål som 5 km på 30:00. Din bästa tid de senaste 8 veckorna räknas ut från loggade löppass
  (Riegels formel från pass på minst halva distansen). Sparas i `ffv-goals` och följer med i exporten.
- Zoom i viktkurvan: välj 2 veckor, månad, 3 månader eller hela planen. Inzoomat anpassas skalan efter de synliga
  vägningarna, så att trenden syns tydligt. Månad är förvald.
- Knapp för att styra fastan själv under läget just nu på Idag: Starta fastan nu, Bryt fastan nu eller, efter att
  ha ätit sent, starta om fastan nu.
- Knappen "Åt något annat? Ersätt" under varje måltid på Idag öppnar formuläret med den måltiden vald.

### Ändrat
- Åt du sent i går (t.ex. 21:00) och har inte loggat dagens första måltid flyttas dagens start fram tills fastan
  är klar (13:00), i stället för att timern börjar om vid den planerade frukosten.
- Formuläret för att ersätta en måltid har numrerade steg, och Huels produkter ligger ihopfällda.
- Profil → Gymdagar länkar till upplägget Helkropp varje pass.

### Rättat
- På smala skärmar låg rättens namn och kalorierna ovanpå varandra i måltidsraderna. Tid och måltid ligger nu på
  en egen rad överst.

## [0.18.2] - 2026-10-18

### Tillagt
- Appen märker själv när en ny version är publicerad: när den visas igen (t.ex. öppnas från iPhones hemskärm
  efter att ha legat i bakgrunden) frågar den servern och erbjuder "Uppdatera nu". Omladdningen hämtar bara nya
  app-filer; sparad data rörs inte. Gäller från den här versionen och framåt.

## [0.18.1] - 2026-10-18

### Rättat
- Tiden för ett konditionspass går att knappa in med bara siffror, som på iPhones sifferknappsats: 003516 blir
  00:35:16. Tidigare slutade kolonerna sättas efter tredje siffran, så tiden gick inte att spara.

## [0.18.0] - 2026-10-15

### Tillagt
- Upplägg för träningspassen under Inställningar → Veckoschema: Appens förslag (som förut) eller Helkropp varje
  pass, hur många gymdagar du än har, t.ex. alla sju. Tränas samma muskler flera dagar i rad visas en varning
  med motivering, men inget blockeras. Valet sparas i `ffv-schedule` (`split`) och följer med i exporten; egna
  val av pass per dag ligger kvar och gäller igen när du byter tillbaka.

## [0.17.1] - 2026-10-15

### Ändrat
- Träningspassen flyttas nu under Inställningar → Veckoschema i stället för under Mat → Veckan: en ruta per dag
  där du drar ett pass (⠿) till en annan dag, med pilar för att byta vecka. Som förut väljer du om flytten bara
  gäller den veckan (t.ex. vid förhinder) eller alla veckor. Under Mat visas passen som förut men utan handtag,
  och en rad med länk när passen är flyttade. Ingen sparad data ändras.
- "Lägg tillbaka i planens ordning" under Mat → Veckan återställer bara måltiderna; flyttade pass läggs tillbaka
  under Veckoschema.

## [0.17.0] - 2026-10-15

### Tillagt
- Tillbehör till eftermiddagsmåltiden, t.ex. pizzasallad: skapa ett eget recept under Mina recept med Måltid
  "Tillbehör till eftermiddagsmåltiden" och välj vilka veckodagar under Inställningar → Måltider. Tillbehöret visas
  som en egen måltid i veckan och på Idag (med kryssruta), räknas in i dagens kalorier och kommer med i
  inköpslistan. Har du flera tillbehör turas de om.
- Byt enskilda råvaror mot billigare alternativ under Inställningar → Inköpslista, t.ex. älgfärs mot kycklingfärs
  eller nötfärs, och renskav eller älgskav mot kyckling eller fläskfilé. Valet gäller alla inbyggda recept, även
  namn och text.
- Nya livsmedel: spetskål och nötfärs 10 %.
- Valen sparas i "ffv-meals" (nya fälten `sideDays` och `swaps`); tillbehören är egna recept med typen `s`. Ingen
  sparad data ändras.

## [0.16.0] - 2026-10-13

### Tillagt
- Flytta ett gympass bara en vecka, t.ex. när något kommer emellan: dra passet (⠿) under Mat → Veckan till en annan
  dag och välj "Bara den här veckan". Gymdagarna i profilen ändras inte, och nästa vecka ligger passen som vanligt.
  "Alla veckor" ändrar gymdagarna som tidigare. Flyttade pass syns på Idag och Träning, och "Lägg tillbaka passen
  enligt planen" ångrar veckans flyttar.
- Veckans flyttar sparas i en ny nyckel (`ffv-trainmoves`) som följer med i exporten. Ingen sparad data ändras.

## [0.15.0] - 2026-10-13

### Tillagt
- Flytta gympassen med dra och släpp under Mat → Veckan: dra passet i handtaget (⠿) till en annan dag. Släpps det
  på en annan gymdag byter passen plats (t.ex. helkropp till lördag och ben till måndag); släpps det på en vilodag
  flyttas passet dit och gymdagarna i profilen ändras. Övriga pass ligger kvar där de var.
- Under Inställningar → Veckoschema kan du också välja vilket pass som körs varje gymdag, och få en varning om samma
  muskler tränas två dagar i rad (inget blockeras).
- Valet sparas i veckoschemat (`ffv-schedule`, nytt fält `session` per dag) och följer med i exporten. Ingen sparad
  data ändras.

## [0.14.3] - 2026-10-11

### Rättat
- Ett eget recept såg annorlunda ut i Idag och Recept än under Inställningar → Mina recept: mängderna skalades om
  näringsämne för näringsämne (t.ex. 20 g ost blev 60 g och 2 ägg blev 3), och rätter med ägg fick 100 g frukt.
  Nu används egna recept precis som de är skrivna, och veckans övriga måltider anpassas efter målen runt dem.
  Ingen sparad data ändras.

## [0.14.2] - 2026-10-10

### Rättat
- En bortvald råvara byttes ut i ingredienserna men stod kvar i rättens namn och text, t.ex. "Kycklingfärsbiffar med
  bulgur" och "Koka bulguren" när bulgur var bortvald och ris användes. Nu skrivs utbytta råvaror om i namn och text
  ("med ris", "Koka riset"), även vid allergier och billiga råvaror (t.ex. "Torsk med …" blir "Sej med …").

## [0.14.1] - 2026-10-10

### Ändrat
- "Billiga råvaror" ligger nu under Inställningar → Inköpslista i stället för under Måltider. Valet är detsamma och
  behålls.

## [0.14.0] - 2026-10-10

### Tillagt
- Välj fuskdag under Inställningar → Måltider, t.ex. fredag i stället för lördag. Godiset (t.ex. "Fredagsgodis")
  och den fria måltiden flyttas dit, och texterna, tabellen för fri måltid, veckoschemat och recepten följer med.
  Veckans övriga rätter ändras inte.

## [0.13.0] - 2026-10-09

### Tillagt
- Bocka av måltider du har ätit, på Idag och i veckoschemat under Mat. Idag visar hur mycket som är ätet av dagens
  kalorier och protein, avbockade måltider stryks över, och loggen visar vad som är ätet. Sparas i dagens loggpost
  (`eaten`).

### Rättat
- Att nollställa dagens måltidstider under Fastan i dag kunde ta bort hela dagens loggpost när den bara innehöll en
  ersatt måltid (t.ex. Huel) eller ett loggat pass. Nu tas en post bara bort när den verkligen är tom.

## [0.12.0] - 2026-10-09

### Tillagt
- Dra och släpp måltider i veckoschemat (Mat → Veckan): dra en måltid i handtaget ⠿ och släpp den på en annan dag,
  så byter de två dagarnas frukost, eftermiddagsmåltid eller efterrätt plats. Fungerar med finger och mus; recepten,
  Idag och inköpslistan följer med. Formuläret "Byt plats på måltider" och Återställ finns kvar.

## [0.11.0] - 2026-10-09

### Tillagt
- Eget kalorimål i Profil (valfritt). Portionerna skalas efter det. Under 1 500 kcal (män) eller 1 200 kcal
  (kvinnor) används golvet med en förklaring; ett mål över underhållsbehovet ger en varning.
- Inställningar → Måltider: efterrätt bara valda veckodagar eller helt avstängd, lördagsgodis av eller på, och
  billiga råvaror (kycklingfärs i stället för älgfärs, sej i stället för torsk och lax, kyckling i stället för
  fläskfilé och kalkon; rätter med räkor, renskav, älgskav eller älgkött tas inte med). Övriga rätter i veckan ändras
  inte av valen.

### Ändrat
- Proteinmålet är sänkt till 2,2 g/kg fettfri massa (tidigare 2,8) eller 1,8 g/kg av vikten vid BMI 27 (tidigare
  2,2), och högst 35 % av kalorierna. Det tidigare målet gav orimligt stora portioner, t.ex. nästan 4 kg kvarg i
  veckan. Når kolhydraterna och fettet sitt tak hamnar veckan hellre något under kalorimålet än får större portioner.

### Rättat
- I veckoschemat under Mat fick lördagsgodiset etiketten "Efterrätt" när en dag saknade efterrätt.

## [0.10.0] - 2026-10-09

### Tillagt
- Arbetstid i Veckoschema (t.ex. 08:00–17:00 måndag–fredag): förslagen läggs efter arbetsdagen, och aktiviteter som
  krockar med arbetstiden får en varning.
- Kryddor och smaksättning med mängd per portion i 33 recept (t.ex. 2 tsk curry, 4 krossade enbär och 1 lagerblad).
  Där det tidigare stod "lite buljong" står nu hur mycket vatten och fond. Allt kommer med i inköpslistan under
  Kryddor och smaksättning.

### Ändrat
- Inköpslistan räknar bort måltider som ersatts med något annat (t.ex. Huel) och inte flyttats.
- Mjölk, filmjölk, havredryck och flytande äggvita visas i liter i inköpslistan.

## [0.9.0] - 2026-10-08

### Tillagt
- Inställningar → Veckoschema: egna tider dag för dag för gympass, intervaller, promenad (t.ex. till och från jobbet)
  och egna aktiviteter. Tomma tider visar appens förslag. Under varje dag visas råd med motivering (överlapp, pass
  efter ätfönstret, intervaller samma dag som styrka eller före benpass, sena pass, promenad efter måltid); inget
  blockeras. Idag, veckoschemat under Mat och tillskottstipsen följer schemat.

### Ändrat
- Gymdagar: 1–7 dagar går att välja. Färre än 3 eller fler än 4 ger en varning med motivering men blockeras inte
  (1–2 dagar ger helkropp, 5 eller fler upprepar över/under-splitten).
- Profil → Träningstider är ersatt av Veckoschema; sparade tider därifrån används fortfarande som förslag.

### Rättat
- På iPhone blev appen kvar uppskjuten när tangentbordet stängdes. Sidan flyttas nu tillbaka, och appen scrollar
  bara sitt innehåll, aldrig själva sidan, när den visar en sektion.
- En tom lista med gymdagar tolkades som måndag.

## [0.8.2] - 2026-10-07

### Rättat
- Egna recept, egna livsmedel, egna tillskott och loggposter som inte gick att läsa in sorterades bort utan varning
  och raderades sedan när något annat sparades. Nu ligger de kvar orörda, skrivs tillbaka vid sparning och följer med
  i exporten. Mina recept visar vilka recept som inte kunde läsas.
- Sparade poster utan giltigt id fick ett nytt slumpat id vid varje start (t.ex. tappade frukostvalet kopplingen till
  ett eget recept). Nu får de ett id som alltid blir detsamma.
- En logg sparad som en ren lista (äldre format) lästes som tom och kunde skrivas över. Nu läses den in.

## [0.8.1] - 2026-10-07

### Tillagt
- Påminnelse på Idag om att säkerhetskopiera när det gått två veckor sedan senaste exporten (eller om ingen export
  finns), med "Påminn mig om en vecka".
- Skydd mot dataförlust i testerna: appen startas med sparad data från varje version (`tests/fixtures/`), och ingen
  sparad data får ändras eller försvinna vid start.
- Regler för datakompatibilitet (`.claude/skills/datakompatibilitet`, `CLAUDE.md`).

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
