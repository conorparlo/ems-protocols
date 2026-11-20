"""Extract internal link annotations from a PDF using only the Python stdlib.

Handles object streams (PDF 1.5+), the page tree, and GoTo / explicit / named
destinations. Output: {page_number(1-based): [{"rect": [x0,y0,x1,y1] (top-left
origin, points), "target_page": int | None, "uri": str | None}]}
"""
import re
import zlib

REF = rb"(\d+)\s+(\d+)\s+R"


class Pdf:
    def __init__(self, path):
        self.data = open(path, "rb").read()
        self.objs = {}
        self._load_top_level()
        self._load_object_streams()

    # ---- object loading -------------------------------------------------
    def _load_top_level(self):
        for m in re.finditer(rb"(?<![\d])(\d+)\s+0\s+obj\b", self.data):
            start = m.end()
            end = self.data.find(b"endobj", start)
            self.objs[int(m.group(1))] = self.data[start:end]

    @staticmethod
    def _stream(body):
        s = body.find(b"stream")
        if s < 0:
            return None
        s += 6
        if body[s:s + 2] == b"\r\n":
            s += 2
        elif body[s:s + 1] in (b"\n", b"\r"):
            s += 1
        e = body.rfind(b"endstream")
        raw = body[s:e]
        if b"/FlateDecode" in body[:body.find(b"stream")]:
            try:
                return zlib.decompressobj().decompress(raw)
            except zlib.error:
                return None
        return raw

    def _load_object_streams(self):
        for num, body in list(self.objs.items()):
            head = body[: body.find(b"stream")] if b"stream" in body else body
            if not re.search(rb"/Type\s*/ObjStm", head):
                continue
            n = int(re.search(rb"/N\s+(\d+)", head).group(1))
            first = int(re.search(rb"/First\s+(\d+)", head).group(1))
            content = self._stream(body)
            if content is None:
                continue
            nums = list(map(int, content[:first].split()))
            pairs = [(nums[i], nums[i + 1]) for i in range(0, 2 * n, 2)]
            for i, (onum, off) in enumerate(pairs):
                a = first + off
                b = first + pairs[i + 1][1] if i + 1 < len(pairs) else len(content)
                self.objs.setdefault(onum, content[a:b])

    # ---- helpers --------------------------------------------------------
    def get(self, num):
        return self.objs.get(num, b"")

    def deref(self, value):
        m = re.fullmatch(rb"\s*" + REF + rb"\s*", value)
        return self.get(int(m.group(1))) if m else value

    @staticmethod
    def dict_value(body, key):
        """Return raw value for /key in a dict body (ref, array, dict, name, string)."""
        m = re.search(rb"/" + key + rb"(?![A-Za-z])\s*", body)
        if not m:
            return None
        i = m.end()
        rest = body[i:]
        r = re.match(REF, rest)
        if r:
            return r.group(0)
        if rest.startswith(b"["):
            return _balanced(rest, b"[", b"]")
        if rest.startswith(b"<<"):
            return _balanced(rest, b"<<", b">>")
        if rest.startswith(b"("):
            return _balanced(rest, b"(", b")")
        t = re.match(rb"/?[^\s/\[\]<>()]+", rest)
        return t.group(0) if t else None

    # ---- pages ----------------------------------------------------------
    def pages(self):
        root_ref = None
        for m in re.finditer(rb"/Root\s+" + REF, self.data):
            root_ref = int(m.group(1))
        root = self.get(root_ref)
        pages_ref = int(re.search(rb"/Pages\s+" + REF, root).group(1))
        out = []

        def walk(num):
            body = self.get(num)
            if re.search(rb"/Type\s*/Pages", body):
                kids = self.deref(self.dict_value(body, b"Kids"))
                for k in re.finditer(REF, kids):
                    walk(int(k.group(1)))
            else:
                out.append(num)

        walk(pages_ref)
        self.root = root
        return out

    def page_height(self, num):
        mb = self.dict_value(self.get(num), b"MediaBox")
        if mb:
            vals = list(map(float, re.findall(rb"-?[\d.]+", self.deref(mb))))
            return vals[3]
        return 792.0

    # ---- named destinations --------------------------------------------
    def named_dests(self):
        dests = {}
        names = self.dict_value(self.root, b"Names")
        if names:
            nd = self.deref(names)
            dref = self.dict_value(nd, b"Dests")
            if dref:
                self._walk_name_tree(self.deref(dref), dests)
        old = self.dict_value(self.root, b"Dests")
        if old:
            body = self.deref(old)
            for m in re.finditer(rb"/([^\s/\[<(]+)\s*(" + REF + rb"|\[[^\]]*\])", body):
                dests[m.group(1)] = m.group(2)
        return dests

    def _walk_name_tree(self, node, out):
        kids = self.dict_value(node, b"Kids")
        if kids:
            for k in re.finditer(REF, self.deref(kids)):
                self._walk_name_tree(self.get(int(k.group(1))), out)
        names = self.dict_value(node, b"Names")
        if names:
            arr = self.deref(names)[1:-1]
            for m in re.finditer(rb"\(((?:\\.|[^\\)])*)\)\s*(" + REF + rb"|\[[^\]]*\])", arr):
                out[m.group(1)] = m.group(2)


def _balanced(s, open_, close):
    depth, i = 0, 0
    while i < len(s):
        if s.startswith(b"\\", i) and open_ == b"(":
            i += 2
            continue
        if s.startswith(open_, i):
            depth += 1
            i += len(open_)
            continue
        if s.startswith(close, i):
            depth -= 1
            i += len(close)
            if depth == 0:
                return s[:i]
            continue
        i += 1
    return s


def extract_links(path):
    pdf = Pdf(path)
    page_nums = pdf.pages()
    page_index = {num: i + 1 for i, num in enumerate(page_nums)}
    named = pdf.named_dests()

    def resolve(dest):
        if dest is None:
            return None
        dest = pdf.deref(dest) if re.fullmatch(rb"\s*" + REF + rb"\s*", dest) else dest
        if dest.startswith(b"(") or dest.startswith(b"/"):
            key = dest[1:-1] if dest.startswith(b"(") else dest[1:]
            dest = named.get(key)
            if dest is None:
                return None
            dest = pdf.deref(dest)
            if dest.startswith(b"<<"):
                dest = pdf.dict_value(dest, b"D")
        m = re.search(REF, dest or b"")
        return page_index.get(int(m.group(1))) if m else None

    result = {}
    for pnum, pobj in enumerate(page_nums, start=1):
        body = pdf.get(pobj)
        annots = pdf.dict_value(body, b"Annots")
        if not annots:
            continue
        height = pdf.page_height(pobj)
        links = []
        for ref in re.finditer(REF, pdf.deref(annots)):
            a = pdf.get(int(ref.group(1)))
            if not re.search(rb"/Subtype\s*/Link", a):
                continue
            rect = list(map(float, re.findall(rb"-?[\d.]+", pdf.dict_value(a, b"Rect") or b"")))
            if len(rect) != 4:
                continue
            x0, y0, x1, y1 = rect
            rect = [round(min(x0, x1), 2), round(height - max(y0, y1), 2),
                    round(max(x0, x1), 2), round(height - min(y0, y1), 2)]
            target, uri = None, None
            dest = pdf.dict_value(a, b"Dest")
            if dest:
                target = resolve(dest)
            else:
                act = pdf.dict_value(a, b"A")
                if act:
                    act = pdf.deref(act)
                    if re.search(rb"/S\s*/GoTo\b", act):
                        target = resolve(pdf.dict_value(act, b"D"))
                    elif re.search(rb"/S\s*/URI", act):
                        u = pdf.dict_value(act, b"URI")
                        uri = u[1:-1].decode("latin-1") if u else None
            links.append({"rect": rect, "target_page": target, "uri": uri})
        if links:
            result[pnum] = links
    return result


if __name__ == "__main__":
    import json
    import sys

    print(json.dumps(extract_links(sys.argv[1]), indent=1))
