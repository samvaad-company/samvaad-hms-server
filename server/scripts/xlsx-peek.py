"""Peek at a large xlsx: header + first N rows, reading only the shared strings those rows use. Usage: xlsx-peek.py file.xlsx [rows]"""
import re, sys, zipfile

path = sys.argv[1]
nrows = int(sys.argv[2]) if len(sys.argv) > 2 else 6
z = zipfile.ZipFile(path)
rows, need = [], set()
buf = b""
with z.open("xl/worksheets/sheet1.xml") as f:
    while len(rows) <= nrows:
        chunk = f.read(1 << 20)
        if not chunk:
            break
        buf += chunk
        for m in re.finditer(rb'<row [^>]*>(.*?)</row>', buf, re.S):
            cells = re.findall(rb'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(?:<v>(.*?)</v>)?</c>)', m.group(1), re.S)
            row = {}
            for col, attrs, v in cells:
                if v is None or v == b"":
                    continue
                if b't="s"' in attrs:
                    row[col.decode()] = ("s", int(v)); need.add(int(v))
                else:
                    row[col.decode()] = ("n", v.decode())
            rows.append(row)
        last = buf.rfind(b"</row>")
        buf = buf[last + 6:] if last >= 0 else buf
strings = {}
buf = b""
idx = 0
with z.open("xl/sharedStrings.xml") as f:
    while need - set(strings):
        chunk = f.read(1 << 22)
        if not chunk:
            break
        buf += chunk
        pos = 0
        while True:
            s = buf.find(b"<si>", pos)
            if s < 0:
                s = buf.find(b"<si ", pos)
            e = buf.find(b"</si>", s) if s >= 0 else -1
            if s < 0 or e < 0:
                break
            if idx in need:
                strings[idx] = re.sub(rb"<[^>]+>", b"", buf[s:e]).decode("utf8", "replace")
            idx += 1
            pos = e + 5
        buf = buf[pos:]
for r in rows[:nrows + 1]:
    print({k: (strings.get(v[1]) if v[0] == "s" else v[1]) for k, v in r.items()})
