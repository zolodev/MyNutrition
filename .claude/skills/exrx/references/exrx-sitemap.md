# ExRx.net – sidkarta för fettförbränning, kost och träning

Bas-URL: `https://exrx.net/`. URL:erna nedan bekräftades via sökning 2026-10-01. Om en sida flyttat, sök med WebSearch (`allowed_domains: ["exrx.net"]`).

## Energi & kalkylatorer
| Sida | URL | Använd för |
|---|---|---|
| Kalkylatoröversikt | `Calculators` | Lista över alla kalkylatorer |
| Estimated Calorie Requirements | `Calculators/CalRequire` | BMR (Harris-Benedict / Katch-McArdle) + aktivitetsbaserat dygnsbehov |
| Calorie Requirement Q&A | `Questions/CalorieRequirement` | Förklaring av beräkningen och felmarginaler |
| Energy Balance | `FatLoss/EnergyBalance` | BMR, termisk effekt (DIT), aktivitetens energikostnad |
| Exercise Calories Burned | `Calculators/Calories` | Förbrukning per aktivitet |
| Walk/Run METs | `Calculators/WalkRunMETs` | Förbrukning promenad/löpning |
| Cycle METs | `Calculators/CycleMETs` | Förbrukning cykelergometer |
| Target Weight / Body Comp | `Calculators/WeightBodyComp` | Målvikt utifrån önskad fettprocent |

## Fettförbränning
| Sida | URL | Använd för |
|---|---|---|
| FatLoss (index) | `FatLoss` | Översikt, länkar till alla artiklar |
| Exercise & Weight Loss | `FatLoss/Exercise` | Kombinera kost, styrka och kondition |
| Misconceptions | `FatLoss/Misconceptions` | Vanliga missuppfattningar |
| HIIT vs Endurance | `FatLoss/HIITvsET` | Intervaller vs lugn kondition (enskild studie, Tremblay 1994) |
| Diet + Exercise study | `FatLoss/DietExStudy` | Kost+träning vs bara kost |
| Weight training + endurance | `FatLoss/WT-End` | Styrka + kondition bevarar fettfri massa |
| WT during caloric restriction | `FatLoss/WTCalLBWStudy` | Styrketräning skyddar muskler i underskott |
| Fat loss & WT myths | `WeightTraining/Myths` | Myter (spot reduction m.m.) |
| Bodybuilder's cardio | `Questions/BodybuildersCardioTraining` | Kondition utan att tappa muskler |
| Starvation effect | `Questions/StarvationEffect` | För stora underskott / "svältläge" |

## Nutrition
| Sida | URL | Använd för |
|---|---|---|
| Protein | `Nutrition/Protein` | Proteinbehov, källor |
| Macronutrients for RT | `Nutrition/Macronutrients` | Makron vid styrketräning (ISSN 1,4–2,0 g/kg) |
| Dietary Guidelines | `Nutrition/DietaryGuidelines` | Allmänna kostråd |
| Substrate Utilization | `Nutrition/Substrates` | Fett vs kolhydrat som bränsle |
| Protein Powder | `Nutrition/Supplements/ProteinPowder` | Proteinpulver |
| Nutrition Abstracts | `Notes/Abstracts/NutritionAbstracts` | Forskningssammanfattningar |
| Diet Development | `Nutrition/DietDevelopment` | Steg för att bygga en kostplan |
| Food Exchange System | `Nutrition/FoodExchanges` | Livsmedelsgrupper med kcal/makron per bytesenhet – grund för receptbygge |
| Meat Exchanges | `Nutrition/MeatExchanges` | Proteinkällor med tillhörande fettenheter |
| Food Exchange Calculator | `Calculators/Exchanges` | Bytesenheter → gram makron/kcal (JS-formulär) |
| Food Exchange Journal | `Nutrition/ExchangeTally` | Matdagbok i bytesenheter |
| Diet Q&A | `Questions/Diet` | Underhållskalorier vs målvikt, matbyten |

## Programdesign
| Sida | URL | Använd för |
|---|---|---|
| Weight Training (index) | `WeightTraining` | Översikt |
| Workout Creation Instructions | `WeightTraining/Instructions` | Steg för att bygga ett pass från mall |
| Program Design | `Questions/WeightTrainingProgramDesign` | Set, reps, frekvens, val av övningar |
| Program Splits | `Questions/WeightTrainingSplits` | Helkropp vs split efter antal dagar |
| Full Body Templates | `Workouts/Workout1LTA` | Helkroppsmallar (2–3 dagar/v) |
| 4-Day Split Template | `Workouts/Workout4PPTS` | 4-dagars split |
| Suspension trainer full body | `Workouts/Workout1ST` | Hemmaträning med slingor |
| Beginning Exercise | `Beginning` | Nybörjarguide |
| Workout Logs | `WeightTraining/WorkoutLogs` | Träningsloggar |

## Övningskatalog
| Sida | URL | Använd för |
|---|---|---|
| Exercise Directory | `Lists/Directory` | Ingång per kroppsdel → muskelgruppslistor |
| Muscle Directory | `Lists/Muscle` | Muskelanatomi, länkar till muskelsidor |
| Nacke | `Lists/ExList/NeckWt` | |
| Axlar | `Lists/ExList/ShouldWt` | |
| Överarm | `Lists/ExList/ArmWt` | |
| Underarm | `Lists/ExList/ForeArmWt` | |
| Rygg | `Lists/ExList/BackWt` | |
| Bröst | `Lists/ExList/ChestWt` | |
| Midja/core | `Lists/ExList/WaistWt` | |
| Höft/säte | `Lists/ExList/HipsWt` | |
| Lår | `Lists/ExList/ThighWt` | |
| Vader | `Lists/ExList/CalfWt` | |
| Miscellaneous | `Lists/OtherExercises` | Kondition, plyometri, stretch m.m. |

Övningslistorna är grupperade per muskel (ankare, t.ex. `ChestWt#Clavicular`) och sedan per utrustning (Barbell, Dumbbell, Cable, Lever, Smith, Body Weight, Suspended …). Enskilda övningssidor ligger under `WeightExercises/<Muskel>/<Övning>` (t.ex. `WeightExercises/PectoralSternal/BBBenchPress`) – hämta listan med `--links` och följ länkarna i stället för att gissa sökvägen.

## Kända egenheter
- Kalkylatorerna (`Calculators/*`) är JavaScript-formulär: sidan beskriver indata, aktivitetsnivåer och källor men visar inte formelkoefficienterna. Räkna själv med standardformlerna (se SKILL.md).
- ExRx svarar 403 på en naken `Mozilla/5.0`-user-agent; skriptet skickar en egen.
