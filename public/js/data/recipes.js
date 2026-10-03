// Recept och säsonger.
//
// RECIPES: mängder i gram per portion.
//   g  = typ av måltid: b frukost, d eftermiddagsmåltid, m efterrätt/tillägg, x lördagsgodis
//   se = säsonger då rätten finns med (utelämnad = hela året)
//   items: [livsmedel, gram]. Ett livsmedel som börjar med @ byts mot säsongens råvara (se SEASONAL).
//   {namn} i titel eller instruktion visar säsongsråvarans korta namn.
// Ordningen i objektet påverkar vilka rätter som slumpas fram; ändra den inte utan anledning.

/** Säsonger i Sverige. */
export const SEASONS = {
  vinter: { n: "Vinter", months: "nov–feb" },
  var: { n: "Vår", months: "mar–maj" },
  sommar: { n: "Sommar", months: "jun–aug" },
  host: { n: "Höst", months: "sep–okt" },
};

/** Vilken råvara en @plats blir under varje säsong. Tomat, gurka och paprika bara på sommaren. */
export const SEASONAL = {
  potatis: { vinter: "potatis", var: "potatis", sommar: "farskpotatis", host: "potatis" },
  gron:    { vinter: "rotfrukter", var: "vitkal", sommar: "broccoli", host: "blomkal" },
  blad:    { vinter: "vitkal", var: "sallad", sommar: "sallad", host: "gronkal" },
  tomat:   { vinter: "kalrot", var: "kalrot", sommar: "tomat", host: "kalrot" },
  morgon:  { vinter: "lingon", var: "lingon", sommar: "tomat", host: "lingon" },
  wok:     { vinter: "kalmix", var: "kalmix", sommar: "sommargron", host: "hostgron" },
  gurka:   { vinter: "morot", var: "morot", sommar: "gurka", host: "morot" },
  paprika: { vinter: "morot", var: "morot", sommar: "paprika", host: "morot" },
  bar:     { vinter: "blabar", var: "blabar", sommar: "jordgubbar", host: "blabarF" },
  frukt:   { vinter: "apple", var: "apple", sommar: "jordgubbar", host: "apple" },
  rot:     { vinter: "rotfrukter", var: "rotfrukter", sommar: "farskpotatis", host: "rotfrukter" },
};

export const RECIPES = {
  F0: { t: "Ägg och kvarg med {bar}", g: "b", items: [["agg", 60], ["aggvita", 200], ["knacke", 12.5], ["kvarg", 150], ["@bar", 75]],
        how: "Rör ihop ägget och äggvitan i en stekpanna med non-stick utan fett, ca 3 min. Ät med en skiva knäckebröd. Toppa kvargen med bären. Samma varje morgon, inget att planera." },
  F1: { t: "Kvarggröt med {bar}", g: "b", items: [["havre", 50], ["mjolk", 150], ["kvarg", 150], ["@bar", 100]],
        how: "Koka havregryn och mjölk 3–4 min. Rör ner kvargen när gröten svalnat något och toppa med bären." },
  F2: { t: "Äggröra på knäckebröd", g: "b", items: [["agg", 60], ["aggvita", 200], ["knacke", 25], ["@morgon", 75], ["@blad", 30]],
        how: "Vispa ägg och äggvita, rör ihop på låg värme i en stekpanna med non-stick. Servera på knäckebröd med {morgon} och de strimlade bladen." },
  F3: { t: "Kvargskål med {frukt}", g: "b", items: [["kvarg", 250], ["havre", 30], ["@frukt", 150]],
        how: "Skär frukten i bitar och strö den och havregrynen över kvargen." },
  F4: { t: "Bärsmoothie med kvarg", g: "b", items: [["mjolk", 200], ["kvarg", 150], ["@bar", 150], ["havre", 30]],
        how: "Mixa allt slätt. Frysta bär gör den tjock och kall." },
  F5: { t: "Omelett med kalkon", g: "b", items: [["agg", 60], ["aggvita", 200], ["kalkon", 50], ["@morgon", 75], ["knacke", 25]],
        how: "Vispa ägg och äggvita, häll i het panna och lägg kalkon och grönsaker på ena halvan. Vik ihop. Knäckebröd vid sidan." },
  F6: { t: "Overnight oats med {frukt} och kanel", g: "b", items: [["havre", 50], ["kvarg", 150], ["mjolk", 100], ["@frukt", 150]],
        how: "Rör ihop havregryn, kvarg, mjölk, riven eller hackad frukt och kanel i en burk kvällen innan. Står klart i kylen på morgonen." },
  F7: { t: "Havregrynsgröt med lingon och kvarg", g: "b", se: ["vinter", "host"], items: [["havre", 60], ["mjolk", 200], ["lingon", 50], ["kvarg", 150]],
        how: "Koka gröten på mjölk. Rör ner kvargen och lägg rårörda eller tinade lingon över." },

  M1: { t: "Keso med {frukt} och kanel", g: "m", items: [["keso", 200], ["@frukt", 150]], how: "Skär frukten i bitar och blanda med kesot. Strö över kanel." },
  M2: { t: "Kvarg med {bar}", g: "m", items: [["kvarg", 200], ["@bar", 100]], how: "Rör ihop. Låt frysta bär tina en stund." },
  M3: { t: "Filmjölk med kvarg, havre och {bar}", g: "m", items: [["filmjolk", 200], ["kvarg", 100], ["havre", 20], ["@bar", 50]], how: "Rör kvargen i filmjölken och toppa med havre och bär." },
  M4: { t: "Ugnsbakat äpple med vaniljkvarg", g: "m", se: ["vinter", "var", "host"], items: [["apple", 150], ["kvarg", 150], ["havre", 10]],
        how: "Halvera äpplet, strö över kanel och havre och baka i 200 °C i 15 min. Servera med kvarg smaksatt med vaniljpulver." },
  M5: { t: "Kalkonrullar och morötter", g: "m", items: [["kalkon", 100], ["keso", 75], ["morot", 150]], how: "Bred keso på kalkonskivorna och rulla ihop. Skär morötterna i stavar." },
  M6: { t: "Knäcke med keso och {morgon}", g: "m", items: [["knacke", 25], ["keso", 150], ["@morgon", 75]], how: "Bred kesot på knäckebrödet och toppa med {morgon}." },

  D1: { se: ["sommar"], t: "Kycklinggryta med ris och {gron}", g: "d", items: [["kyckling", 175], ["ris", 60], ["@gron", 150], ["tomat", 200], ["lok", 50], ["olja", 5]],
        how: "Koka riset. Fräs hackad lök och kycklingbitar i oljan, lägg i hackade färska tomater, paprikapulver och vitlök och låt sjuda 10 min. Koka eller ugnsrosta grönsakerna." },
  D2: { t: "Ugnsbakad sej med {potatis} och dillkvarg", g: "d", items: [["sej", 175], ["@potatis", 250], ["olja", 5], ["@blad", 50], ["@tomat", 100], ["@gurka", 100], ["kvarg", 75]],
        how: "Koka potatisen. Lägg sejen i en form, ringla över oljan, salta och baka i 200 °C i 12–15 min. Rör kvarg med dill, citron och salt till sås. Servera med säsongens grönsaker." },
  D3: { se: ["sommar"], t: "Chili con carne", g: "d", items: [["algfars", 125], ["brunabonor", 120], ["tomat", 250], ["lok", 50], ["@paprika", 100], ["ris", 40], ["olja", 5]],
        how: "Bryn älgfärsen med lök. Tillsätt grönsakerna, chili, spiskummin, hackade färska tomater och sköljda bönor. Sjud 20 min. Servera med ris." },
  D4: { t: "Torsk med {potatis}, {gron} och dillkvarg", g: "d", items: [["torsk", 175], ["@potatis", 250], ["@gron", 150], ["olja", 5], ["kvarg", 50]],
        how: "Lägg torsken i form, ringla över olja, salta och baka i 200 °C i 12–15 min. Koka potatis och grönsaker. Rör kvarg med dill, persilja och citron." },
  D5: { t: "Kycklingwok med {wok}", g: "d", items: [["kyckling", 150], ["@wok", 250], ["ris", 60], ["olja", 5]],
        how: "Koka riset. Stek kycklingstrimlor i oljan, tillsätt de strimlade grönsakerna, smaka av med soja, ingefära och vitlök." },
  D6: { se: ["sommar"], t: "Tacoskål med kyckling", g: "d", items: [["kyckling", 150], ["tortilla", 60], ["brunabonor", 60], ["@blad", 50], ["@tomat", 100], ["@gurka", 50], ["ost", 10], ["kvarg", 50], ["olja", 5]],
        how: "Stek kycklingen med tacokrydda. Värm tortillan. Bygg skålen med bönor, grönsaker och ost. Kvarg med lime och salt ersätter gräddfil." },
  D7: { se: ["sommar"], t: "Pasta bolognese med röda linser", g: "d", items: [["algfars", 100], ["linser", 30], ["tomat", 250], ["lok", 50], ["pasta", 70], ["ost", 10], ["olja", 5]],
        how: "Bryn älgfärs och lök. Tillsätt linser, hackade färska tomater och 2 dl vatten, sjud 15–20 min tills linserna mjuknat. Servera med pasta och ost." },
  D8: { t: "Kycklingfärsbiffar med bulgur och tzatziki", g: "d", items: [["kycklingfars", 150], ["bulgur", 60], ["@gurka", 100], ["@tomat", 100], ["kvarg", 75], ["olja", 5]],
        how: "Forma färsen med salt, oregano och riven lök till 3 biffar och stek 4 min per sida. Koka bulguren. Riv hälften av grönsakerna i kvargen med vitlök och salt." },
  D9: { se: ["sommar"], t: "Räkpasta med tomat och {blad}", g: "d", items: [["rakor", 150], ["pasta", 70], ["tomat", 200], ["@blad", 50], ["lok", 30], ["olja", 5], ["ost", 10]],
        how: "Koka pastan. Fräs lök och vitlök i oljan, lägg i hackade färska tomater och sjud 5 min. Vänd ner räkor och strimlade blad sista minuten. Toppa med ost." },
  D10: { t: "Fläskfilé med {potatis} och pepparkvarg", g: "d", items: [["flaskfile", 150], ["@potatis", 250], ["@gron", 150], ["olja", 5], ["kvarg", 50]],
        how: "Bryn fläskfilén runt om i oljan och låt den bli klar i 175 °C ugn till 65 °C innertemperatur. Koka potatis och grönsaker. Rör kvarg med svartpeppar och lite buljong till sås." },
  D11: { t: "Ugnskyckling med {rot}", g: "d", items: [["kyckling", 175], ["@rot", 250], ["potatis", 100], ["olja", 5], ["kvarg", 50]],
        how: "Skär rotfrukter och potatis i bitar och vänd i olja, salt och timjan. Baka med kycklingen i 200 °C i 25–30 min. Kvarg med vitlök som sås." },
  D12: { se: ["sommar"], t: "Torskgryta med tomat och gula ärtor", g: "d", items: [["torsk", 175], ["gulaartor", 100], ["tomat", 250], ["lok", 50], ["@paprika", 100], ["ris", 40], ["olja", 5]],
        how: "Fräs lök och grönsaker, tillsätt hackade färska tomater, gula ärtor och paprikapulver och sjud 10 min. Lägg i torskbitarna och sjud 5–6 min under lock. Servera med ris." },
  D13: { t: "Hamburgare utan bröd med ugnsklyftor", g: "d", items: [["algfars", 125], ["@potatis", 250], ["olja", 5], ["@blad", 50], ["@tomat", 100], ["@gurka", 100], ["kvarg", 50]],
        how: "Skär potatisen i klyftor, vänd i oljan och baka i 225 °C i 25–30 min. Forma färsen till två biffar och stek. Servera med grönsaker och kvarg rörd med senap och dill." },
  D14: { t: "Äggviteomelett med {potatis} och {blad}", g: "d", items: [["agg", 60], ["aggvita", 300], ["@potatis", 200], ["@blad", 50], ["@tomat", 100], ["ost", 10], ["olja", 5]],
        how: "Skiva kokt potatis och stek i en non-stickpanna med en droppe olja. Vispa ägg och äggvita, häll över, lägg på bladen och osten och låt stelna under lock på låg värme." },
  D15: { t: "Kycklingcurry med ris", g: "d", items: [["kyckling", 175], ["ris", 60], ["@wok", 150], ["mjolk", 100], ["kvarg", 50], ["lok", 50]],
        how: "Fräs lök, curry och vitlök. Tillsätt kycklingbitar, mjölk och en skvätt buljong, sjud 10 min. Rör ner kvargen precis innan servering. Rör ner grönsakerna sista 5 min. Servera med ris." },
  D16: { t: "Sejgratäng med {blad}", g: "d", items: [["sej", 175], ["@blad", 100], ["kvarg", 75], ["ost", 10], ["@potatis", 250], ["olja", 5]],
        how: "Lägg strimlade blad och sej i en form. Rör kvarg med dill, citron och salt och bred över, strö på osten. Baka i 200 °C i 20 min. Servera med kokt potatis." },
  // Säsongsrätter (vilt, svamp, bär och rotfrukter)
  S1: { t: "Renskav med potatismos och lingon", g: "d", se: ["vinter", "var"], items: [["renskav", 150], ["potatis", 250], ["mjolk", 75], ["lingon", 50], ["rotfrukter", 100], ["lok", 30], ["olja", 5]],
        how: "Fräs löken, lägg i renskavet och låt det tina i pannan. Häll i en skvätt mjölk och låt puttra 5 min. Mosa potatisen med resten av mjölken. Servera med lingon och kokta rotfrukter." },
  S8: { t: "Älgskav med svamp och rotfruktsmos", g: "d", se: ["vinter", "var", "host"], items: [["algskav", 175], ["svamp", 75], ["lok", 30], ["rotfrukter", 250], ["potatis", 100], ["lingon", 40], ["kvarg", 50], ["olja", 5]],
        how: "Fräs svamp och lök i oljan, lägg i älgskavet och stek tills det tinat och fått färg. Rör ner kvargen och lite buljong. Koka rotfrukter och potatis och mosa. Servera med lingon." },
  S9: { t: "Renskavswok med kål och morot", g: "d", se: ["vinter", "var", "host"], items: [["renskav", 175], ["kalmix", 300], ["ris", 50], ["olja", 5]],
        how: "Koka riset. Stek renskavet hårt i hälften av oljan och lägg åt sidan. Woka kål och morot i resten av oljan, vänd tillbaka köttet och smaka av med soja, ingefära och en nypa enbär." },
  S10: { t: "Tunnbrödsrulle med renskav och lingonkvarg", g: "d", items: [["renskav", 150], ["tunnbrod", 40], ["kvarg", 75], ["lingon", 40], ["@blad", 50], ["lok", 30], ["olja", 5]],
        how: "Stek renskav och lök i oljan. Rör lingon i kvargen. Lägg strimlade blad, renskav och lingonkvarg på tunnbrödet och rulla ihop." },
  S2: { t: "Älgfärsbiffar med rotfruktsmos", g: "d", se: ["vinter", "var", "host"], items: [["algfars", 150], ["rotfrukter", 250], ["potatis", 100], ["kvarg", 50], ["lingon", 30], ["lok", 30], ["olja", 5]],
        how: "Blanda älgfärsen med riven lök, salt och peppar och stek 3 biffar. Koka rotfrukter och potatis och mosa med lite kokvatten. Servera med kvarg rörd med enbär eller timjan, och lingon." },
  S3: { t: "Kålsoppa med kycklingfärs", g: "d", se: ["vinter", "var"], items: [["kycklingfars", 150], ["vitkal", 250], ["morot", 100], ["potatis", 150], ["lok", 50], ["olja", 5]],
        how: "Bryn färsen i små bollar. Koka strimlad kål, morot, potatis och lök i buljong 15 min. Lägg i köttbullarna sista 5 min. Smaka av med kryddpeppar." },
  S4: { t: "Grillad kyckling med färskpotatissallad", g: "d", se: ["sommar"], items: [["kyckling", 175], ["farskpotatis", 250], ["gurka", 100], ["radisor", 50], ["kvarg", 75], ["olja", 5]],
        how: "Grilla eller stek kycklingen. Koka färskpotatisen, låt svalna och blanda med skivad gurka, rädisor, kvarg, dill och gräslök." },
  S5: { t: "Kokt torsk med färskpotatis och äggsås light", g: "d", se: ["sommar"], items: [["torsk", 175], ["farskpotatis", 250], ["agg", 60], ["kvarg", 75], ["sallad", 50], ["olja", 5]],
        how: "Sjud torsken i lättsaltat vatten med dill i 6–8 min. Hacka ett kokt ägg och rör ner i kvarg med dill, senap och salt. Servera med färskpotatis och sallad." },
  S6: { t: "Älggryta med svamp och rotfrukter", g: "d", se: ["host", "vinter"], items: [["algkott", 150], ["svamp", 100], ["rotfrukter", 200], ["potatis", 150], ["lok", 50], ["kvarg", 50], ["olja", 5]],
        how: "Bryn köttet och löken, häll på buljong, enbär och lagerblad och låt puttra 1,5 h. Lägg i rotfrukter och svamp sista 30 min. Rör ner kvargen precis innan servering. Servera med kokt potatis." },
  S7: { t: "Kycklingsoppa med svamp och grönkål", g: "d", se: ["host"], items: [["kyckling", 150], ["svamp", 100], ["gronkal", 75], ["potatis", 150], ["mjolk", 100], ["lok", 50], ["olja", 5]],
        how: "Fräs svamp och lök, lägg i kycklingbitar och potatis och häll på buljong. Koka 15 min, rör ner mjölk och strimlad grönkål sista minuterna." },

  // Lördagsgodis – ett godare alternativ till godispåsen, ätet som efterrätt i eftermiddagsmåltiden
  G1: { t: "Chokladdoppade jordgubbar", g: "x", se: ["sommar"], items: [["jordgubbar", 150], ["choklad", 15]], how: "Smält chokladen och doppa jordgubbarna. Låt stelna i kylen 10 min." },
  G2: { t: "Fryst kvargbark med {bar} och mörk choklad", g: "x", items: [["kvarg", 150], ["@bar", 50], ["choklad", 10]],
        how: "Bred ut kvargen tunt på bakplåtspapper, strö över bär och hackad choklad och frys 2 h. Bryt i bitar." },
  G3: { t: "Äppelchips med kanel", g: "x", se: ["vinter", "var", "host"], items: [["apple", 200]],
        how: "Skiva äpplet tunt, strö över kanel och torka i 100 °C ugn i 1,5–2 h. Förvara i burk." },
  G5: { t: "Varma {bar} med kvarg och rostad havre", g: "x", se: ["vinter", "var", "host"], items: [["@bar", 100], ["kvarg", 100], ["havre", 15]],
        how: "Värm bären i en kastrull. Rosta havren torrt i en panna. Lägg bären över kvargen och strö havren över." },
  G6: { t: "Popcorn med salt", g: "x", items: [["popcorn", 30]], how: "Poppa majsen i en torr kastrull med lock eller i mikron i en papperspåse. Krydda med salt och gärna paprikapulver." }
};

/** Platshållare när ingen rätt passar valda allergier. */
export const NONE = "NONE";
RECIPES[NONE] = { t: "Ingen rätt passar dina val", g: "none", items: [], how: "Ta bort något bortval eller lägg till ett eget livsmedel som ersättare." };
