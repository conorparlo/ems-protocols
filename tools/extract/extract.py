"""Extract per-page structured source data from the protocols PDF.

Uses only the Python stdlib + poppler CLI tools (pdftotext, pdftocairo, pdftoppm).

Usage: python3 -I tools/extract/extract.py <protocols.pdf> <out_dir> [--pages 74,82] [--no-png]

Writes:
  <out_dir>/pages/NNN.json   lines (words + bbox + fill color + scope level + link targets),
                             filled boxes, links
  <out_dir>/pages/NNN.png    page render (150 dpi)
  <out_dir>/index.json       page -> protocol id/title map
"""
import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdflinks import extract_links  # noqa: E402

# Box fill -> certification level (see PDF "0010 Introduction" protocol key).
# Matched by nearest color; anything not close to one of these is reported raw.
LEVEL_COLORS = {
    "EMT": (255, 255, 0),        # yellow: EMT / EMT-IV
    "AEMT": (102, 255, 102),     # green
    "EMT-I": (255, 204, 102),    # orange
    "PARAMEDIC": (102, 204, 255),  # blue
}
OTHER_COLORS = {
    "PEDIATRIC": (204, 153, 255),  # purple: pediatric box
    "GERIATRIC": (146, 208, 80),   # green: geriatric box
}
# NOTE: medication pages (9000+) and tables (e.g. IMC-RASS, Broselow colors) use their own
# palettes; those fills are reported raw (kind=None) and must not be read as scope levels.
# Medication scope comes from the 0990 Quick Reference matrix instead.


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True).stdout


def parse_rgb(s):
    m = re.match(r"rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)", s or "")
    if not m:
        return None
    return tuple(round(float(v) * 2.55) for v in m.groups())


def classify(rgb):
    if rgb is None:
        return None
    r, g, b = rgb
    if max(rgb) - min(rgb) <= 6 and 200 <= r <= 240:
        return "TEACHING"  # neutral grey
    best, dist = None, 1e9
    for name, ref in {**LEVEL_COLORS, **OTHER_COLORS}.items():
        d = sum((a - b) ** 2 for a, b in zip(rgb, ref)) ** 0.5
        if d < dist:
            best, dist = name, d
    return best if dist < 25 else None


def apply(m, x, y):
    a, b, c, d, e, f = m
    return a * x + c * y + e, b * x + d * y + f


def parse_matrix(t):
    if not t:
        return (1, 0, 0, 1, 0, 0)
    m = re.search(r"matrix\(([^)]*)\)", t)
    if not m:
        return (1, 0, 0, 1, 0, 0)
    return tuple(float(v) for v in re.split(r"[\s,]+", m.group(1).strip()))


def mul(m1, m2):
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def filled_boxes(pdf, page, tmp):
    svg = os.path.join(tmp, f"p{page}.svg")
    subprocess.run(["pdftocairo", "-svg", "-f", str(page), "-l", str(page), pdf, svg], check=True)
    tree = ET.parse(svg)
    ns = "{http://www.w3.org/2000/svg}"
    boxes = []

    def walk(el, mat):
        mat = mul(mat, parse_matrix(el.get("transform")))
        if el.tag == ns + "path" and el.get("fill") and not el.get("d", "").count("C"):
            rgb = parse_rgb(el.get("fill"))
            if rgb and rgb not in ((0, 0, 0), (255, 255, 255)):
                nums = list(map(float, re.findall(r"-?[\d.]+", el.get("d", ""))))
                pts = [apply(mat, nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]
                if pts:
                    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
                    w, h = max(xs) - min(xs), max(ys) - min(ys)
                    if w > 5 and h > 5:
                        boxes.append({"bbox": [round(min(xs), 2), round(min(ys), 2),
                                               round(max(xs), 2), round(max(ys), 2)],
                                      "rgb": list(rgb), "kind": classify(rgb)})
        # <use> of <symbol>/<g> glyphs carry no fills we care about
        for child in el:
            walk(child, mat)

    walk(tree.getroot(), (1, 0, 0, 1, 0, 0))
    return boxes


def words_and_lines(pdf, page):
    out = run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox-layout", pdf, "-"]).decode("utf-8")
    out = re.sub(r"<!DOCTYPE[^>]*>", "", out)
    out = out.replace("&nbsp;", " ")
    root = ET.fromstring(out)
    lines = []
    for line in root.iter("{http://www.w3.org/1999/xhtml}line"):
        words = []
        for w in line.iter("{http://www.w3.org/1999/xhtml}word"):
            words.append({"t": html.unescape(w.text or ""),
                          "bbox": [round(float(w.get(k)), 2) for k in ("xMin", "yMin", "xMax", "yMax")]})
        if words:
            lines.append({"words": words, "bbox": [round(float(line.get(k)), 2)
                                                   for k in ("xMin", "yMin", "xMax", "yMax")]})
    return lines


def contains(box, pt):
    x, y = pt
    return box[0] - 1 <= x <= box[2] + 1 and box[1] - 1 <= y <= box[3] + 1


def center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def area(b):
    return (b[2] - b[0]) * (b[3] - b[1])


HEADER = re.compile(r"^\s*(\d{4})\s+(.*\S)\s*$")


def detect_header(lines):
    """Protocol id/title from the first heading-like line, e.g. '4010 UNIVERSAL ALTERED MENTAL STATUS'."""
    for ln in lines[:8]:
        text = " ".join(w["t"] for w in ln["words"])
        if text.strip() == "Table of Contents":
            continue
        m = HEADER.match(text)
        if m:
            return m.group(1), m.group(2)
        return None, text.strip()
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("out")
    ap.add_argument("--pages")
    ap.add_argument("--no-png", action="store_true")
    args = ap.parse_args()

    info = run(["pdfinfo", args.pdf]).decode()
    npages = int(re.search(r"Pages:\s+(\d+)", info).group(1))
    pages = [int(p) for p in args.pages.split(",")] if args.pages else range(1, npages + 1)
    os.makedirs(os.path.join(args.out, "pages"), exist_ok=True)

    links = extract_links(args.pdf)
    index_path = os.path.join(args.out, "index.json")
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}

    with tempfile.TemporaryDirectory() as tmp:
        for p in pages:
            lines = words_and_lines(args.pdf, p)
            boxes = filled_boxes(args.pdf, p, tmp)
            pid, title = detect_header(lines)
            if not pid or pid >= "9000":
                # Medication pages / appendices: colors are table styling, not scope.
                for b in boxes:
                    if b["kind"] != "TEACHING":
                        b["kind"] = None
            plinks = links.get(p, [])
            for ln in lines:
                for w in ln["words"]:
                    c = center(w["bbox"])
                    inside = [b for b in boxes if contains(b["bbox"], c)]
                    if inside:
                        b = min(inside, key=lambda b: area(b["bbox"]))
                        w["fill"] = b["kind"] or "rgb(%d,%d,%d)" % tuple(b["rgb"])
                    for lk in plinks:
                        if contains(lk["rect"], c) and lk["target_page"]:
                            w["link"] = lk["target_page"]
                fills = {w.get("fill") for w in ln["words"]}
                if len(fills) == 1 and None not in fills:
                    ln["fill"] = fills.pop()
            index[str(p)] = {"id": pid, "title": title}
            page_doc = {"page": p, "protocol_id": pid, "title": title,
                        "boxes": boxes, "links": plinks, "lines": lines}
            with open(os.path.join(args.out, "pages", f"{p:03d}.json"), "w") as f:
                json.dump(page_doc, f, indent=1)
            if not args.no_png:
                subprocess.run(["pdftoppm", "-f", str(p), "-l", str(p), "-r", "150", "-png",
                                "-singlefile", args.pdf, os.path.join(args.out, "pages", f"{p:03d}")],
                               check=True)
            print(f"page {p}: {pid} {title!r} lines={len(lines)} boxes={len(boxes)} links={len(plinks)}",
                  file=sys.stderr)

    with open(index_path, "w") as f:
        json.dump(dict(sorted(index.items(), key=lambda kv: int(kv[0]))), f, indent=1)


if __name__ == "__main__":
    main()
