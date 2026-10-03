#!/usr/bin/env python3
"""Fetch an ExRx.net page and print it as plain text.

Usage: fetch_exrx.py <url-or-path> [--links]
  url-or-path  full URL or a path like "Calculators/CalRequire"
  --links      also list the page's links (absolute URLs) at the end
"""
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin

BASE = "https://exrx.net/"
# ExRx answers 403 to a bare "Mozilla/5.0" user agent
USER_AGENT = "Mozilla/5.0 (exrx-skill)"
SKIP = {"script", "style", "noscript", "svg", "head"}
BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "table", "ul", "ol", "section"}


class TextExtractor(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base, self.out, self.links, self.skip = base, [], [], 0
        self.href, self.link_text = None, []

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip += 1
        elif tag in BLOCK:
            self.out.append("\n")
        elif tag in ("td", "th"):
            self.out.append(" | ")
        if tag == "a":
            self.href, self.link_text = dict(attrs).get("href"), []

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip:
            self.skip -= 1
        elif tag in BLOCK:
            self.out.append("\n")
        if tag == "a" and self.href:
            text = " ".join("".join(self.link_text).split())
            if text and not self.href.startswith(("#", "javascript:", "mailto:")):
                self.links.append((text, urljoin(self.base, self.href)))
            self.href = None

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)
            if self.href:
                self.link_text.append(data)

    def text(self):
        lines = [" ".join(line.split()) for line in "".join(self.out).splitlines()]
        lines = [line for line in lines if line.strip("| ")]
        # Drop the site-wide menu: content starts at the title above the "ExRx.net > ..." breadcrumb
        crumb = next((i for i, line in enumerate(lines) if line.startswith("ExRx.net >")), None)
        if crumb:
            lines = lines[crumb - 1:]
        return "\n".join(lines)


def main():
    args = [a for a in sys.argv[1:] if a != "--links"]
    if len(args) != 1:
        sys.exit(__doc__)
    url = args[0] if args[0].startswith("http") else urljoin(BASE, args[0].lstrip("/"))
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode(resp.headers.get_content_charset() or "utf-8", "replace")
            final_url = resp.geturl()
    except urllib.error.URLError as e:
        sys.exit(f"Could not fetch {url}: {e}. Try WebSearch with allowed_domains ['exrx.net'].")

    parser = TextExtractor(final_url)
    parser.feed(html)
    print(f"# {final_url}\n")
    print(parser.text())
    if "--links" in sys.argv:
        print("\n## Links")
        seen = set()
        for text, href in parser.links:
            if href not in seen:
                seen.add(href)
                print(f"- {text}: {href}")


if __name__ == "__main__":
    main()
