#!/usr/bin/env python3
"""Lokal testserver för appen: som `python3 -m http.server`, men med
Cache-Control: no-cache (webbläsaren frågar alltid om en fil har ändrats, så gamla och nya
JavaScript-moduler blandas aldrig) och charset=utf-8 för textfiler (å, ä och ö visas rätt).

    python3 scripts/serve.py [port] [katalog]     # standard: port 8000, katalogen public
"""
import http.server
import sys
from functools import partial

TEXT_TYPES = {".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html",
              ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml"}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      **{ext: f"{mime}; charset=utf-8" for ext, mime in TEXT_TYPES.items()}}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    directory = sys.argv[2] if len(sys.argv) > 2 else "public"
    print(f"Serverar {directory}/ på http://0.0.0.0:{port}/ (Ctrl+C avslutar)")
    http.server.ThreadingHTTPServer(("", port), partial(Handler, directory=directory)).serve_forever()
