#!/usr/bin/env python3
"""Höj appens version enligt semantisk versionshantering (https://semver.org/lang/sv/).

    npm run bump -- patch     0.1.0 -> 0.1.1   rättningar
    npm run bump -- minor     0.1.0 -> 0.2.0   nya funktioner (före 1.0 även ändringar som inte är bakåtkompatibla)
    npm run bump -- major     0.1.0 -> 1.0.0   första release, därefter ändringar som inte är bakåtkompatibla
    npm run bump -- 0.3.0     sätt en bestämd version

Versionen finns på tre ställen som alltid ska vara lika (testerna kontrollerar det):
package.json, public/js/version.js och public/sw.js (cachens namn, så att installerade appar hämtar de nya filerna).
Rubriken "Ej släppt" i CHANGELOG.md blir den nya versionen med dagens datum.
"""

import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def bump(current: str, part: str) -> str:
    if SEMVER.match(part):
        return part
    major, minor, patch = map(int, SEMVER.match(current).groups())
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    sys.exit(f"Okänd del: {part}. Använd patch, minor, major eller en version som 0.3.0.")


def replace(path: pathlib.Path, pattern: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, new, text, count=1)
    if not count:
        sys.exit(f"Hittade inte versionen i {path.relative_to(ROOT)}")
    path.write_text(updated, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    package = ROOT / "package.json"
    current = json.loads(package.read_text(encoding="utf-8"))["version"]
    new = bump(current, sys.argv[1])

    replace(package, r'"version": "[^"]+"', f'"version": "{new}"')
    replace(ROOT / "public/js/version.js", r'APP_VERSION = "[^"]+"', f'APP_VERSION = "{new}"')
    replace(ROOT / "public/sw.js", r'const VERSION = "ffv-[^"]+"', f'const VERSION = "ffv-{new}"')

    changelog = ROOT / "CHANGELOG.md"
    today = datetime.date.today().isoformat()
    text = changelog.read_text(encoding="utf-8")
    if "## [Ej släppt]" in text:
        text = text.replace("## [Ej släppt]", f"## [Ej släppt]\n\n## [{new}] - {today}", 1)
        changelog.write_text(text, encoding="utf-8")

    print(f"{current} -> {new}. Skriv vad som ändrats under [{new}] i CHANGELOG.md och kör testerna.")


if __name__ == "__main__":
    main()
