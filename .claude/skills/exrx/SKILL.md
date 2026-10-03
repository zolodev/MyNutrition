---
name: exrx
description: Bygger fettförbränningsplaner – träningsprogram, kaloriberäkningar och recept för viktnedgång – med ExRx.net (exrx.net) som faktakälla, hämtad live. Använd den här skillen när användaren vill gå ner i vikt eller fett, bygga ett träningsprogram eller träningsschema, välja övningar för en muskel eller viss utrustning, räkna ut kaloribehov/BMR/TDEE/underskott eller proteinbehov, eller vill ha recept, matsedlar eller måltidsplaner för viktnedgång – även om ExRx inte nämns. Använd den också när användaren nämner exrx, ExRx-övningar eller ExRx-mallar.
---

# ExRx – fettförbränning: träning + kost

Målet är att ge användaren konkreta, källgrundade planer för **fettförbränning med bibehållen muskelmassa**: ett kalorimål, ett proteinmål, ett träningsprogram och recept som träffar målen. ExRx.net är källan för träningslära, övningar, energiberäkningar och näringsprinciper. Hämta alltid aktuella sidor live i stället för att lita på minnet – användaren har uttryckligen valt det så att råden går att spåra till ExRx.

Svara på svenska, med metriska enheter (kg, cm, gram, kcal) och svenska livsmedel som finns i vanliga matbutiker.

## Hämta från ExRx

Sidkartan i `references/exrx-sitemap.md` listar de URL:er som är relevanta (kalkylatorer, fettförbränningsartiklar, nutrition, programdesign, övningskatalog). Läs den först så du vet var du ska leta.

Hämtningsordning – ta nästa om en metod saknas eller nekas:
1. **WebFetch** på URL:en, med en prompt som säger exakt vad du behöver ut (formel, siffror, övningslista).
2. **Skriptet**: `python3 .claude/skills/exrx/scripts/fetch_exrx.py <url-eller-sökväg> [--links]` – ger sidan som ren text; `--links` listar även länkar, vilket behövs för att navigera övningskatalogen ned till enskilda övningar.
3. **WebSearch** med `allowed_domains: ["exrx.net"]` – ger bara utdrag, men räcker ofta för att bekräfta en siffra eller hitta rätt sida.

Om en URL i sidkartan ger 404, sök fram rätt sida med WebSearch hellre än att gissa.

Hämta bara det som behövs för frågan – oftast 2–5 sidor. Ange vilka ExRx-sidor du använt som länkar i slutet av svaret, så användaren kan läsa vidare och kontrollera.

## Arbetsgång

### 1. Ta reda på utgångsläget
För kaloriberäkningar och program behövs: kön, ålder, vikt, längd, ev. fettprocent, aktivitetsnivå, träningsvana, hur många dagar/vecka och hur lång tid per pass, tillgänglig utrustning (gym, hemma, bara kroppsvikt), skador/begränsningar och kostpreferenser/allergier. Fråga efter det som saknas och spelar roll – men om användaren bara vill ha ett recept eller en övningslista behövs inte hela profilen.

### 2. Energi och makron
- Hämta `Calculators/CalRequire` (indata, aktivitetsnivåer med exempelaktiviteter) och `FatLoss/EnergyBalance`. Kalkylatorn är ett JS-formulär utan synliga koefficienter, så räkna BMR själv med samma formler som ExRx anger – visa formeln och mellanstegen så användaren kan följa räkningen:
  - **Katch-McArdle** (om fettprocent finns): BMR = 370 + 21,6 × fettfri massa (kg)
  - **Harris-Benedict** (1919, som ExRx citerar): män 66,5 + 13,75·vikt + 5,003·längd − 6,755·ålder; kvinnor 655,1 + 9,563·vikt + 1,850·längd − 4,676·ålder
- Lägg på aktivitet → underhållsbehov (TDEE), antingen via ExRx-metoden (timmar per aktivitetsnivå över dygnet) eller en aktivitetsfaktor. ExRx påpekar att uppskattningarna kan avvika 20–30 % och att de flesta överskattar sin aktivitetsnivå, så presentera det som en startpunkt som justeras efter 2–3 veckors faktisk viktutveckling.
- Underskott: sikta på en takt runt 0,5–1 % av kroppsvikten per vecka. Ett måttligt underskott bevarar muskler och ork bättre – ExRx-studierna om kostrestriktion visar att styrketräning + måttlig restriktion ger bäst kroppssammansättning.
- Protein: hämta `Nutrition/Macronutrients` och `Nutrition/Protein`. Under underskott, lägg proteinet i övre delen av ExRx/ISSN-spannet (runt 1,6–2,2 g/kg) eftersom det skyddar muskelmassan och har hög termisk effekt.
- Fördela resten på fett (inte för lågt, ca 0,6–1 g/kg) och kolhydrater.

### 3. Träningsprogram
- Läs `Questions/WeightTrainingProgramDesign`, `Questions/WeightTrainingSplits` och `WeightTraining/Instructions`. Välj mall efter antal dagar: 2–3 dagar → helkropp (`Workouts/Workout1LTA`), 4 dagar → split (`Workouts/Workout4PPTS`).
- Välj övningar ur övningskatalogen (`Lists/Directory` → muskelgruppens `Lists/ExList/...`) efter användarens utrustning. Föredra basövningar (compound) – ExRx rekommenderar en basövning per muskelgrupp för nybörjare. Länka varje övning till dess ExRx-sida så användaren kan se utförandet.
- Styrketräningen är kärnan vid fettförbränning: den bevarar muskelmassa i underskott (`FatLoss/WTCalLBWStudy`, `FatLoss/WT-End`). Lägg till kondition – intervaller (HIIT) och/eller lågintensiv kondition (promenader) – efter tid och återhämtning (`FatLoss/HIITvsET`, `FatLoss/Exercise`).
- Ange för varje pass: övning, set × reps, vila, och en progressionsregel (t.ex. öka reps inom spannet, sedan vikt). Håll volymen rimlig under underskott eftersom återhämtningen är sämre.

### 4. Recept och matsedel
ExRx har inga recept – där används ExRx för målen (kcal, protein, principer om proteinets mättnad/termiska effekt) och för **matbytessystemet** (`Nutrition/FoodExchanges`, `Nutrition/MeatExchanges`, `Nutrition/DietDevelopment`), och du bygger recepten själv.
- Matbytessystemet är ett bra skelett för en matsedel: fördela dagens kcal/makron på bytesenheter (stärkelse, grönsaker, frukt, mjölk, kött, fett) per måltid och fyll sedan enheterna med konkreta svenska råvaror. Använd metriska mått (250 ml/kopp enligt ExRx).
- Bygg recept som träffar måltidens andel av dagsmålen. Prioritera hög proteintäthet, mycket grönsaker/fibrer för mättnad och enkla, vardagliga råvaror.
- Ange för varje recept: portioner, ingredienser i gram, kort tillagning, och **per portion**: kcal, protein, kolhydrater, fett. Näringsvärdena är uppskattningar från standardvärden – säg det, och hänvisa gärna till Livsmedelsverkets livsmedelsdatabas för exakta värden.
- För en dags- eller veckomatsedel: summera per dag och visa avvikelsen mot målen.

### 5. Läs ExRx kritiskt
Många ExRx-artiklar är äldre och bygger ibland på enstaka studier (t.ex. påståendet att HIIT ger "nio gånger" mer fettförlust per kalori kommer från en enda studie från 1994). Återge ExRx korrekt, men tona inte upp enskilda studier till säkra regler – säg när något bygger på en enskild studie.

## Säkerhet
Rekommendera inte under ca 1200 kcal/dag (kvinnor) eller 1500 kcal/dag (män) utan medicinsk uppföljning, och inte snabbare viktnedgång än ca 1 % av kroppsvikten per vecka. Vid graviditet, diabetes, hjärt-kärlsjukdom, ätstörningshistorik eller under 18 år: ge allmän information och hänvisa till läkare/dietist i stället för en exakt plan.

## Svarsformat för en hel plan
```
## Utgångsläge          – sammanfattade uppgifter och antaganden
## Energi & makron      – BMR (formel + steg), TDEE, kcal-mål, protein/fett/kolhydrater i gram
## Träningsprogram      – veckoschema, pass med övningar (ExRx-länkar), set × reps, vila, progression
## Kost                 – recept/matsedel med näringsvärden per portion och dagssumma
## Uppföljning          – vad som mäts och hur kcal justeras efter 2–3 veckor
## Källor (ExRx)        – länkar till sidorna som använts
```
Svarar du bara på en del (t.ex. ett recept eller en övningslista), använd bara relevanta delar.
