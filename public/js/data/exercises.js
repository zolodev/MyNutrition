// Övningar från ExRx övningskatalog. Varje övning är [namn, sökväg under EXRX_URL].

export const EXRX_URL = "https://exrx.net/WeightExercises/";

/**
 * Övningar per utrustning (gym, hantlar, kroppsvikt) och rörelse. Varje rörelse har flera alternativ som
 * växlar mellan veckorna (se training.js); det första är grundövningen. Alla sökvägar finns i ExRx övningslistor.
 */
export const EXERCISES = {
  gym: {
    squat: [["Knäböj, skivstång", "Quadriceps/BBSquat"], ["Frontböj, skivstång", "Quadriceps/BBFrontSquat"], ["Benpress 45°", "Quadriceps/SL45LegPress"], ["Knäböj, hantlar", "Quadriceps/DBSquat"]],
    hinge: [["Rumänsk marklyft", "OlympicLifts/RomanianDeadlift"], ["Marklyft, skivstång", "GluteusMaximus/BBDeadlift"], ["Raka marklyft, hantlar", "Hamstrings/DBStrBackStrLegDeadlift"], ["Good morning, skivstång", "Hamstrings/BBGoodMorning"]],
    single: [["Utfall, hantlar", "GluteusMaximus/DBLunge"], ["Bakåtutfall, hantlar", "GluteusMaximus/DBRearLunge"], ["Splitknäböj, hantlar", "Quadriceps/DBSplitSquat"], ["Step-up, hantlar", "GluteusMaximus/DBStepUp"]],
    glute: [["Höftlyft, skivstång", "GluteusMaximus/BBHipThrust"], ["Ryggresning 45°", "Hamstrings/BW45HyperextensionHips"], ["Liggande lårcurl, maskin", "Hamstrings/LVLyingLegCurl"]],
    push: [["Bänkpress, skivstång", "PectoralSternal/BBBenchPress"], ["Bänkpress, hantlar", "PectoralSternal/DBBenchPress"], ["Lutande bänkpress, skivstång", "PectoralClavicular/BBInclineBenchPress"], ["Lutande bänkpress, hantlar", "PectoralClavicular/DBInclineBenchPress"]],
    vpush: [["Militärpress, skivstång", "DeltoidAnterior/BBMilitaryPress"], ["Axelpress, hantlar", "DeltoidAnterior/DBShoulderPress"], ["Arnoldpress, hantlar", "DeltoidAnterior/DBArnoldPress"], ["Sittande axelpress, kabel", "DeltoidAnterior/CBShoulderPress"]],
    row: [["Sittande rodd, kabel", "BackGeneral/CBSeatedRow"], ["Framåtböjd rodd, skivstång", "BackGeneral/BBBentOverRow"], ["Framåtböjd rodd, hantlar", "BackGeneral/DBBentOverRow"], ["Sittande rodd brett grepp, kabel", "BackGeneral/CBWideGripSeatedRow"]],
    vpull: [["Latsdrag", "LatissimusDorsi/CBFrontPulldown"], ["Latsdrag, smalt grepp", "LatissimusDorsi/CBCloseGripPulldown"], ["Chins", "LatissimusDorsi/BWUnderhandChinup"], ["Pull-ups", "LatissimusDorsi/BWPullup"]],
    push2: [["Armhävningar", "PectoralSternal/BWPushup"], ["Dips för bröstet", "PectoralSternal/BWChestDip"], ["Flyes, hantlar", "PectoralSternal/DBFly"]],
    curl: [["Bicepscurl, kabel", "Biceps/CBCurl"], ["Bicepscurl, skivstång", "Biceps/BBCurl"], ["Bicepscurl, hantlar", "Biceps/DBCurl"], ["Lutande bicepscurl, hantlar", "Biceps/DBInclineCurl"]],
    tri: [["Triceps pushdown, kabel", "Triceps/CBPushdown"], ["Liggande tricepsextension, skivstång", "Triceps/BBLyingTriExt"], ["Dips för triceps", "Triceps/BWTriDip"], ["Tricepsextension över huvudet, hantel", "Triceps/DBTriExt"]],
    calf: [["Stående vadpress, maskin", "Gastrocnemius/LVStandingCalfRaise"], ["Sittande vadpress, maskin", "Gastrocnemius/LVSeatedCalfPress"], ["Enbens vadpress, hantel", "Gastrocnemius/DBSingleLegCalfRaise"]],
  },
  db: {
    squat: [["Knäböj, hantlar", "Quadriceps/DBSquat"], ["Frontböj, hantlar", "Quadriceps/DBFrontSquat"]],
    hinge: [["Raka marklyft, hantlar", "Hamstrings/DBStrBackStrLegDeadlift"], ["Enbens raka marklyft", "GluteusMaximus/BWSingleLegStiffLegDeadlift"]],
    single: [["Splitknäböj, hantlar", "Quadriceps/DBSplitSquat"], ["Utfall, hantlar", "GluteusMaximus/DBLunge"], ["Bakåtutfall, hantlar", "GluteusMaximus/DBRearLunge"], ["Step-down, hantlar", "Quadriceps/DBStepDown"]],
    glute: [["Step-up, hantlar", "GluteusMaximus/DBStepUp"], ["Enbens höftbrygga, foten på bänk", "Hamstrings/BWSingleLegHangingHamstringBridge"]],
    push: [["Bänkpress, hantlar (bänk eller golv)", "PectoralSternal/DBBenchPress"], ["Lutande bänkpress, hantlar", "PectoralClavicular/DBInclineBenchPress"], ["Armhävningar", "PectoralSternal/BWPushup"]],
    vpush: [["Axelpress, hantlar", "DeltoidAnterior/DBShoulderPress"], ["Arnoldpress, hantlar", "DeltoidAnterior/DBArnoldPress"], ["Enarms axelpress, hantel", "DeltoidAnterior/DBOneArmShoulderPress"]],
    row: [["Framåtböjd rodd, hantlar", "BackGeneral/DBBentOverRow"], ["Liggande rodd, hantlar", "BackGeneral/DBLyingRow"]],
    vpull: [["Inverterad rodd (under bord)", "BackGeneral/BWSupineRow"], ["Inverterad rodd, underhandsgrepp", "BackGeneral/BWUnderhandSupineRow"], ["Pullover, hantel", "PectoralSternal/DBPullover"]],
    push2: [["Armhävningar", "PectoralSternal/BWPushup"], ["Lutande armhävningar", "PectoralSternal/BWInclinePushup"], ["Flyes, hantlar", "PectoralSternal/DBFly"]],
    curl: [["Bicepscurl, hantlar", "Biceps/DBCurl"], ["Lutande bicepscurl, hantlar", "Biceps/DBInclineCurl"], ["Koncentrationscurl, hantel", "Brachialis/DBConcentrationCurl"]],
    tri: [["Liggande tricepsextension, hantlar", "Triceps/DBLyingTriExt"], ["Tricepsextension över huvudet, hantel", "Triceps/DBTriExt"], ["Kickback, hantel", "Triceps/DBKickback"]],
    calf: [["Enbens vadpress, hantel", "Gastrocnemius/DBSingleLegCalfRaise"], ["Stående vadpress, hantlar", "Gastrocnemius/DBStandingCalfRaise"]],
  },
  bw: {
    squat: [["Knäböj, kroppsvikt", "Quadriceps/BWSquat"], ["Enbensknäböj mot stol", "GluteusMaximus/BWSingleLegBoxSquat"]],
    hinge: [["Enbens raka marklyft", "GluteusMaximus/BWSingleLegStiffLegDeadlift"], ["Enbens höftbrygga, foten på stol", "Hamstrings/BWSingleLegHangingHamstringBridge"]],
    single: [["Splitknäböj, kroppsvikt", "Quadriceps/BWSplitSquat"], ["Utfall, kroppsvikt", "GluteusMaximus/BWLunge"], ["Bakåtutfall, kroppsvikt", "GluteusMaximus/BWRearLunge"], ["Bulgarisk splitknäböj", "GluteusMaximus/BWSingleLegSplitSquat"]],
    glute: [["Step-up på stol/trappa", "GluteusMaximus/BWStepUp"], ["Step-down från trappsteg", "Quadriceps/BWStepDown"]],
    push: [["Armhävningar", "PectoralSternal/BWPushup"], ["Lutande armhävningar", "PectoralSternal/BWInclinePushup"], ["Archer-armhävningar", "PectoralSternal/BWArcherPushup"]],
    vpush: [["Pike press", "DeltoidAnterior/BWPikePress"], ["Pike press, fötterna upphöjda", "DeltoidAnterior/BWDeclinePikePress"]],
    row: [["Inverterad rodd (under bord)", "BackGeneral/BWSupineRow"], ["Inverterad rodd, fötterna upphöjda", "BackGeneral/BWSupineRowFeetElevated"]],
    vpull: [["Pull-ups om stång finns, annars inverterad rodd", "LatissimusDorsi/BWPullup"], ["Chins om stång finns", "LatissimusDorsi/BWUnderhandChinup"], ["Inverterad rodd, underhandsgrepp", "BackGeneral/BWUnderhandSupineRow"]],
    push2: [["Armhävningar på knä", "PectoralSternal/BWPushupKnee"], ["Armhävningar, smalt grepp", "Triceps/BWCloseGripPushup"]],
    curl: [["Inverterad rodd, underhandsgrepp", "BackGeneral/BWUnderhandSupineRow"], ["Chins om stång finns", "LatissimusDorsi/BWUnderhandChinup"]],
    tri: [["Dips mellan stolar", "Triceps/BWBenchDip"], ["Armhävningar, smalt grepp", "Triceps/BWCloseGripPushup"]],
    calf: [["Enbens vadpress", "Gastrocnemius/BWSingleLegCalfRaise"], ["Stående vadpress, kroppsvikt", "Gastrocnemius/BWStandingCalfRaise"]],
  },
};

/** Bålövningar. Planka högst en gång i veckan, en intensiv bålcirkel en gång i veckan. */
export const CORE = {
  plank: ["Planka", "RectusAbdominis/BWFrontPlank"],
  side: ["Sidoplanka", "Obliques/BWSidePlank"],
  birddog: ["Fågelhund", "ErectorSpinae/BWBirdDog"],
  rear: ["Ryggbrygga (omvänd planka)", "ErectorSpinae/BackPlank"],
  circuit: {
    gym: [["Knästående kabelcrunch", "RectusAbdominis/CBKneelingCrunch", "12–15"], ["Hängande benlyft", "HipFlexors/BWHangingLegRaise", "8–12"], ["Sidoplanka", "Obliques/BWSidePlank", "30 s/sida"], ["Ryggbrygga (omvänd planka)", "ErectorSpinae/BackPlank", "30 s"]],
    db: [["Crunch med vikt", "RectusAbdominis/WtCrunch", "12–15"], ["Liggande benlyft", "HipFlexors/BWLyingLegRaise", "12–15"], ["Sidoböj, hantel", "Obliques/DBSideBend", "12/sida"], ["Sidoplanka", "Obliques/BWSidePlank", "30 s/sida"]],
    bw: [["Crunch", "RectusAbdominis/BWCrunch", "15–20"], ["Liggande benlyft", "HipFlexors/BWLyingLegRaise", "12–15"], ["Sidoplanka", "Obliques/BWSidePlank", "30–45 s/sida"], ["Fågelhund", "ErectorSpinae/BWBirdDog", "10/sida"]]
  },
};
