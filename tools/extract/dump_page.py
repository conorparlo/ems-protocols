"""Print a compact, conversion-ready view of extracted pages.

Usage: python3 -I tools/extract/dump_page.py content/source 74 82 ...

Each line: [FILL] text  {links: page->protocol id}
Lines are grouped into blocks by shared fill/vertical proximity so flowchart boxes stay together.
"""
import json
import os
import sys


def main():
    src, pages = sys.argv[1], [int(p) for p in sys.argv[2:]]
    index = json.load(open(os.path.join(src, "index.json")))

    def target(page):
        e = index.get(str(page), {})
        return f"{e.get('id') or '?'}:{(e.get('title') or '')[:40]}"

    for p in pages:
        d = json.load(open(os.path.join(src, "pages", f"{p:03d}.json")))
        print(f"===== page {p}  {d['protocol_id']}  {d['title']}")
        lines = sorted(d["lines"], key=lambda l: (round(l["bbox"][1] / 4), l["bbox"][0]))
        for ln in lines:
            text = " ".join(w["t"] for w in ln["words"])
            if text.strip() in ("Table of Contents", "Boulder County Protocol Revision April 2026"):
                continue
            fills = sorted({w.get("fill") for w in ln["words"] if w.get("fill")})
            links = sorted({w["link"] for w in ln["words"] if w.get("link")})
            x = int(ln["bbox"][0])
            tag = f"[{','.join(fills)}]" if fills else ""
            lk = "  {" + "; ".join(f"p{l}={target(l)}" for l in links) + "}" if links else ""
            print(f"x{x:3d} y{int(ln['bbox'][1]):3d} {tag} {text}{lk}")


if __name__ == "__main__":
    main()
