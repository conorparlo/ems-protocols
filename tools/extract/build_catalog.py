"""Build app/content/catalog.json: every protocol/medication id -> title, category, pages.

Usage: python3 -I tools/extract/build_catalog.py content/source app/content/catalog.json

Titles come from the table of contents (pages 3-7) when numbered there, otherwise from the
first heading line on the protocol's first page (medications).
"""
import json
import os
import re
import sys

TOC_PAGES = range(2, 8)  # table of contents spans pages 3-7
SKIP = {"Table of Contents", "Boulder County Protocol Revision April 2026", "Dosage and Administration"}


def category(pid):
    n = int(pid)
    for lo, cat in ((9000, "medication"), (8000, "trauma"), (7000, "obstetric"), (6000, "behavioral"),
                    (5000, "environmental"), (4000, "medical"), (3000, "cardiac"), (2000, "respiratory"),
                    (1000, "procedure"), (0, "general")):
        if n >= lo:
            return cat


def smart_title(s):
    small = {"and", "or", "of", "the", "with", "for", "to", "in", "a", "as", "by", "on"}
    keep = {"CPAP", "BRUE", "ALTE", "TIA", "ROSC", "STEMI", "CHF", "TXA", "IV", "IO", "ASA", "OEC",
            "EMS", "ECG", "CO", "VT", "VF", "II", "SL", "IM", "IN", "ED"}
    out = []
    for i, w in enumerate(s.split()):
        core = re.sub(r"[^A-Za-z]", "", w)
        if core.upper() in keep and core.isupper():
            out.append(w)
        elif i and w.lower() in small:
            out.append(w.lower())
        else:
            out.append(re.sub(r"[A-Za-z]+", lambda m: m.group(0).capitalize(), w, count=1)
                       if w.isupper() else w)
    return " ".join(out)


def main():
    src, out = sys.argv[1], sys.argv[2]
    index = json.load(open(os.path.join(src, "index.json")))

    toc = {}
    for p in TOC_PAGES:
        d = json.load(open(os.path.join(src, "pages", f"{p:03d}.json")))
        for ln in d["lines"]:
            t = " ".join(w["t"] for w in ln["words"])
            m = re.match(r"^(\d{4})\s+(.+)$", t.strip())
            if m:
                toc[m.group(1)] = m.group(2).strip()

    catalog = {}
    for page, e in index.items():
        pid = e["id"]
        if not pid or int(page) in TOC_PAGES:
            continue
        entry = catalog.setdefault(pid, {"id": pid, "pages": [], "category": category(pid)})
        entry["pages"].append(int(page))
        if "title" not in entry:
            title = toc.get(pid)
            if not title:
                d = json.load(open(os.path.join(src, "pages", f"{int(page):03d}.json")))
                lines = [" ".join(w["t"] for w in l["words"]).strip() for l in d["lines"]]
                lines = [l for l in lines if l and l not in SKIP and not re.match(r"^\d{4}\b", l)]
                title = smart_title(lines[0]) if lines else e["title"]
            entry["title"] = title

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump(dict(sorted(catalog.items())), f, indent=1)
    print(f"{len(catalog)} entries -> {out}")


if __name__ == "__main__":
    main()
