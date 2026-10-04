// Appens version enligt semantisk versionshantering (https://semver.org/lang/sv/): MAJOR.MINOR.PATCH.
// Före 1.0.0 är appen under utveckling: MINOR höjs för nya funktioner eller ändringar som inte är bakåtkompatibla,
// PATCH för rättningar. Ändra inte för hand; kör `npm run bump -- patch|minor|major` (scripts/version.py), som
// också uppdaterar package.json, sw.js och CHANGELOG.md.
export const APP_VERSION = "0.2.0";
