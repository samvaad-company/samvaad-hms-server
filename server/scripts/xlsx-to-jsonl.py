"""Streams a large drugs xlsx into JSON lines with only the columns the medicine master needs. Usage: xlsx-to-jsonl.py in.xlsx out.jsonl"""
import json, re, sys, zipfile

src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
COLS = {"A": "productId", "B": "name", "C": "marketer", "D": "composition", "E": "type", "K": "packaging", "L": "package", "M": "qty", "N": "form", "O": "mrp", "P": "rx"}

# Pass 1: which shared strings the wanted cells use.
rows, need, buf, n = [], set(), b"", 0
cell = re.compile(rb'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(?:<is>.*?</is>|<v>(.*?)</v>)?</c>)', re.S)
with z.open("xl/worksheets/sheet1.xml") as f:
    while True:
        chunk = f.read(1 << 22)
        if not chunk:
            break
        buf += chunk
        end = buf.rfind(b"</row>")
        if end < 0:
            continue
        part, buf = buf[: end + 6], buf[end + 6:]
        for m in re.finditer(rb"<row [^>]*>(.*?)</row>", part, re.S):
            row = {}
            for col, _r, attrs, v in cell.findall(m.group(1)):
                c = col.decode()
                if c not in COLS or not v:
                    continue
                if b't="s"' in attrs:
                    i = int(v); row[c] = ("s", i); need.add(i)
                else:
                    row[c] = ("n", v.decode())
            rows.append(row)
print("rows", len(rows), "strings needed", len(need), file=sys.stderr)

# Pass 2: pull those strings out of the (huge) shared string table.
strings, idx, buf = {}, 0, b""
tag = re.compile(rb"<[^>]+>")
with z.open("xl/sharedStrings.xml") as f:
    while True:
        chunk = f.read(1 << 23)
        if not chunk:
            break
        buf += chunk
        pos = 0
        while True:
            s = buf.find(b"<si>", pos)
            e = buf.find(b"</si>", s) if s >= 0 else -1
            if s < 0 or e < 0:
                break
            if idx in need:
                strings[idx] = tag.sub(b"", buf[s:e]).decode("utf8", "replace").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").strip()
            idx += 1
            pos = e + 5
        buf = buf[pos:]
print("shared strings read", idx, file=sys.stderr)

out = 0
with open(dst, "w", encoding="utf8") as o:
    for r in rows[1:]:
        rec = {COLS[c]: (strings.get(v[1], "") if v[0] == "s" else v[1]) for c, v in r.items()}
        if rec.get("name"):
            o.write(json.dumps(rec, ensure_ascii=False) + "\n"); out += 1
print("written", out, file=sys.stderr)
