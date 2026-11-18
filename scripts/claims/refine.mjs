/**
 * Second pass over what detect.mjs found, using the page's drawn boxes:
 *  - an answer that sits on a row of letter boxes is written one character to a box (names, addresses, phone numbers, dates, times);
 *  - gender (and the admission type) is ticked in its own tick box, or marked in its radio circle.
 */
const DATE = new Set(["dob", "admissionDate", "dischargeDate"]);
const TIME = new Set(["admissionTime"]);
const NAMES = new Set(["insuredName", "patientName", "doctorName"]);

function boxesOf(page) {
  const out = [];
  for (const r of page.rects ?? []) out.push({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h });
  for (const q of page.shapes?.squares ?? []) if (q.x1 - q.x0 >= 6) out.push({ x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1 });
  const rows = new Map();
  for (const v of page.vlines ?? []) {
    const h = v.y1 - v.y0;
    if (h < 7 || h > 28) continue;
    const k = `${Math.round(v.y0 * 2) / 2}:${Math.round(v.y1 * 2) / 2}`;
    (rows.get(k) || rows.set(k, { y0: v.y0, y1: v.y1, xs: [] }).get(k)).xs.push(v.x);
  }
  for (const r of rows.values()) {
    const xs = [...r.xs].sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > 1);
    for (let i = 1; i < xs.length; i++) { const g = xs[i] - xs[i - 1]; if (g >= 5.5 && g <= 26) out.push({ x0: xs[i - 1], x1: xs[i], y0: r.y0, y1: r.y1 }); }
  }
  // the same box drawn twice (an outline and a fill, or a few hundredths apart) counts once
  const kept = [];
  for (const b of out.sort((a, c) => a.x0 - c.x0 || a.y1 - c.y1)) if (!kept.some((k) => Math.abs(k.x0 - b.x0) < 2.5 && Math.abs(k.y1 - b.y1) < 1.6)) kept.push(b);
  // a box drawn inside a bigger one on the same row (an outline and its inner edge) is not a box of its own
  return kept.filter((b) => !kept.some((o) => o !== b && o.x0 <= b.x0 + 0.5 && o.x1 >= b.x1 - 0.5 && o.x1 - o.x0 > b.x1 - b.x0 + 1 && o.y0 <= b.y0 + 0.5 && o.y1 >= b.y1 - 0.5));
}

/** Runs of touching, equal boxes on one row. */
function runsOf(boxes) {
  const rows = [];
  for (const b of [...boxes].sort((a, b) => a.y1 - b.y1)) {
    const r = rows.find((q) => Math.abs(q.y1 - b.y1) <= 1.3);
    if (r) r.list.push(b); else rows.push({ y1: b.y1, list: [b] });
  }
  const runs = [];
  for (const r of rows) {
    const list = r.list.sort((a, b) => a.x0 - b.x0);
    let cur = [list[0]];
    for (const b of list.slice(1)) {
      const p = cur[cur.length - 1];
      if (b.x0 - p.x1 <= 2.5 && Math.abs((b.x1 - b.x0) - (p.x1 - p.x0)) <= 2) cur.push(b); else { runs.push(cur); cur = [b]; }
    }
    runs.push(cur);
  }
  return runs.filter((r) => r.length >= 2).map((boxes) => ({ boxes, x0: boxes[0].x0, x1: boxes[boxes.length - 1].x1, y0: Math.min(...boxes.map((b) => b.y0)), y1: boxes[0].y1, pitch: (boxes[boxes.length - 1].x1 - boxes[0].x0) / boxes.length }));
}

/** Runs on the same row a short gap apart (DD  MM  YYYY) read as one group. */
function groupRuns(runs, maxGap, tol = 2.5) {
  const rows = [];
  for (const r of [...runs].sort((a, b) => a.y1 - b.y1)) { const q = rows.find((c) => Math.abs(c.y1 - r.y1) <= 1.6); if (q) q.list.push(r); else rows.push({ y1: r.y1, list: [r] }); }
  const out = [];
  for (const { list } of rows) {
    list.sort((a, b) => a.x0 - b.x0);
    let cur = list[0];
    for (const r of list.slice(1)) {
      if (r.x0 - cur.x1 <= maxGap && Math.abs(r.pitch - cur.pitch) <= tol) cur = { boxes: [...cur.boxes, ...r.boxes], x0: cur.x0, x1: r.x1, y0: Math.min(cur.y0, r.y0), y1: cur.y1, pitch: cur.pitch };
      else { out.push(cur); cur = r; }
    }
    out.push(cur);
  }
  return out;
}

/** One answer spread over a group of boxes: each character goes in a box centre, and the hint letters printed in the boxes are wiped. */
function cellsSpot(page, p, g, boxes) {
  const h = g.y1 - g.y0, base = g.y1 - Math.max(2.4, h * 0.27);
  const wipe = [];
  for (const l of page.lines ?? []) for (const it of l.items) {
    if (!it.s.trim() || it.y < g.y0 - 1 || it.y > g.y1 + 2) continue;
    for (const b of boxes) if (Math.min(it.x + it.w, b.x1) - Math.max(it.x, b.x0) > 1.2) wipe.push({ x: +(b.x0 + 0.9).toFixed(1), y: +(b.y0 + 0.9).toFixed(1), w: +(b.x1 - b.x0 - 1.8).toFixed(1), h: +(b.y1 - b.y0 - 1.8).toFixed(1) });
  }
  const uniq = wipe.filter((w, j) => wipe.findIndex((q) => Math.abs(q.x - w.x) < 0.5 && Math.abs(q.y - w.y) < 0.5) === j);
  const pitch = (boxes[boxes.length - 1].x1 - boxes[0].x0) / boxes.length;
  return { p, x: +boxes[0].x0.toFixed(1), y: +base.toFixed(1), w: +(boxes[boxes.length - 1].x1 - boxes[0].x0).toFixed(1), cells: boxes.map((b) => +((b.x0 + b.x1) / 2).toFixed(2)), cw: +pitch.toFixed(1), by: +g.y1.toFixed(1), bh: +h.toFixed(1), ...(uniq.length ? { wipe: uniq } : {}) };
}

/** Of the boxes in a date or time group, the ones that carry its hint letters (D D M M Y Y): a stray extra box is left out. */
function pickBoxes(page, boxes, sizes, fallback) {
  const hinted = boxes.filter((b) => (page.lines ?? []).some((l) => l.items.some((it) => /^[DMYHdmyh][DMYHdmyh\s:\/]*$/.test(it.s.trim()) && it.y >= b.y0 - 1 && it.y <= b.y1 + 2 && Math.min(it.x + it.w, b.x1) - Math.max(it.x, b.x0) > 1.2)));
  return sizes.includes(hinted.length) ? hinted : fallback;
}

export function refine(pages, fields, drop = []) {
  const refined = {};
  const prep = pages.map((pg) => {
    const runs = runsOf(boxesOf(pg));
    return { runs, merged: groupRuns(runs, 26, 4), wide: groupRuns(runs, 34, 5), names: groupRuns(runs, 70, 5) };
  });
  // 0. an answer that belongs after a colon far from its label starts after the colon; an occupation printed as a list of options is not a text answer
  for (const [key, spots] of Object.entries(fields)) {
    fields[key] = spots.filter((s) => {
      const lines = (pages[s.p]?.lines ?? []).filter((l) => Math.abs(l.y - s.y) <= 3);
      if (key === "occupation" && lines.some((l) => /homemaker|self.?employed|retired/i.test(l.items.map((i) => i.s).join(" ")))) return false;
      if (s.cells || s.comb) return true;
      // a placeholder printed in the answer cell (DD/MM/YYYY, HH/MM, YY/MM): the answer goes there, over it
      if (DATE.has(key) || TIME.has(key) || key === "age") {
        for (const l of lines) {
          const hint = l.items.find((i) => /^(DD[\/-]MM[\/-]YYYY|HH[\/:]MM|YY[\/-]MM)$/i.test(i.s.trim()) && i.x > s.x + 8);
          if (!hint) continue;
          const wall = (pages[s.p].vlines ?? []).filter((v) => v.x > hint.x + 6 && v.y0 <= l.y && v.y1 >= l.y - 8).map((v) => v.x).sort((a, b) => a - b)[0];
          const right = wall ?? hint.x + 100;
          s.x = +(hint.x - 1).toFixed(1); s.w = +(right - s.x - 3).toFixed(1);
          s.wipe = [{ x: +(hint.x - 1).toFixed(1), y: +(hint.y - (hint.h || 7) - 0.5).toFixed(1), w: +(hint.w + 2).toFixed(1), h: +((hint.h || 7) + 2).toFixed(1) }];
          return true;
        }
      }
      for (const l of lines) {
        const colon = l.items.find((i) => i.s.trim() === ":" && i.x > s.x + 10 && i.x < s.x + 140);
        if (!colon) continue;
        const after = l.items.find((i) => i.x > colon.x + 2 && i.s.trim());
        const x = colon.x + colon.w + 3, right = after ? after.x - 3 : (pages[s.p].w ?? 595) - 28, w = right - x;
        if (w >= 40) { s.x = +x.toFixed(1); s.w = +w.toFixed(1); delete s.wipe; }
        break;
      }
      return true;
    });
    if (!fields[key].length) delete fields[key];
  }
  // 1. answers on letter boxes
  for (const [key, spots] of Object.entries(fields)) {
    spots.forEach((s, i) => {
      if (s.cells || s.comb || drop.includes(key)) return;
      const pr = prep[s.p]; if (!pr) return;
      const isDate = DATE.has(key), isTime = TIME.has(key), isAge = key === "age";
      const pool = isDate || isTime ? pr.merged : isAge ? pr.runs : NAMES.has(key) ? pr.names : pr.wide;
      const cands = pool.filter((g) => s.y >= g.y0 - 0.8 && s.y <= g.y1 + 4.5 && g.x0 >= s.x - 9 && g.x0 <= s.x + s.w + 6);
      cands.sort((a, b) => a.x0 - b.x0);
      let g = cands[0];
      if (!g) return;
      let boxes = g.boxes;
      const min = isAge ? 2 : isDate ? 6 : 4;
      if (boxes.length < min) return;
      if (isAge && boxes.length > 3) return;
      if (isDate) boxes = pickBoxes(pages[s.p], boxes, [6, 8, 10], boxes.slice(0, boxes.length >= 10 ? 10 : boxes.length >= 8 ? 8 : 6));
      if (isTime) boxes = pickBoxes(pages[s.p], boxes, [4], boxes.slice(0, boxes.length >= 6 ? 4 : boxes.length));
      spots[i] = { ...cellsSpot(pages[s.p], s.p, g, boxes), ctx: s.ctx, label: s.label };
    });
  }
  // 1c. a date or time written on one underline cut by short dividers (dd | mm | yyyy): each part goes in its own stretch, and the hint letters are wiped
  for (const key of [...DATE, ...TIME]) {
    (fields[key] ?? []).forEach((s, i, arr) => {
      if (s.cells || s.comb || s.segs) return;
      const pg = pages[s.p]; if (!pg) return;
      const h = (pg.hlines ?? []).filter((q) => Math.abs(q.y - s.y) <= 8 && q.x0 >= s.x - 6 && q.x0 <= s.x + s.w + 8 && q.x1 - q.x0 >= 30).sort((a, b) => a.x0 - b.x0 || Math.abs(a.y - s.y) - Math.abs(b.y - s.y))[0];
      if (!h) return;
      const divs = [...new Set((pg.vlines ?? []).filter((v) => v.x > h.x0 + 3 && v.x < h.x1 - 3 && v.y0 <= h.y + 2 && v.y1 >= h.y - 4 && v.y1 - v.y0 <= 16).map((v) => Math.round(v.x * 2) / 2))].sort((a, b) => a - b);
      const want = DATE.has(key) ? 2 : 1;
      if (divs.length !== want) return;
      const edges = [h.x0, ...divs, h.x1];
      const segs = edges.slice(0, -1).map((x, k) => ({ x: +x.toFixed(1), w: +(edges[k + 1] - x).toFixed(1) }));
      const wipe = [];
      for (const l of pg.lines ?? []) for (const it of l.items) if (it.s.trim() && it.y >= h.y - 14 && it.y <= h.y + 2 && it.x >= h.x0 - 2 && it.x + it.w <= h.x1 + 2 && /^[dmyhDMYH\s:\/|.-]+$/.test(it.s.trim())) wipe.push({ x: +(it.x - 1).toFixed(1), y: +(it.y - (it.h || 7) - 0.5).toFixed(1), w: +(it.w + 2).toFixed(1), h: +((it.h || 7) + 2).toFixed(1) });
      // hint letters that are drawn, not text: cover the space above each stretch (not the dividers)
      if (!wipe.length) for (const g of segs) wipe.push({ x: +(g.x + 0.9).toFixed(1), y: +(h.y - 9.8).toFixed(1), w: +(g.w - 1.8).toFixed(1), h: 9 });
      arr[i] = { p: s.p, x: segs[0].x, y: +(h.y - 1.8).toFixed(1), w: +(h.x1 - h.x0).toFixed(1), segs, ...(wipe.length ? { wipe } : {}), ctx: s.ctx, label: s.label };
    });
  }
  // 1d. the admission time written on an underline cut once (hh | mm), after "Time" on the admission date's line
  if (!drop.includes("admissionTime")) pages.forEach((pg, p) => {
    for (const l of pg.lines ?? []) {
      const adm = l.items.find((q) => /date of admission|admission date/i.test(q.s));
      const tm = adm && l.items.find((q) => q.x > adm.x + adm.w && /(^|[^a-z])time([^a-z]|$)/i.test(q.s));
      if (!tm) continue;
      const h = (pg.hlines ?? []).filter((q) => Math.abs(q.y - l.y) <= 8 && q.x0 >= tm.x + tm.w - 3 && q.x0 <= tm.x + tm.w + 120 && q.x1 - q.x0 >= 20 && q.x1 - q.x0 <= 120).sort((a, b) => a.x0 - b.x0)[0];
      if (!h) continue;
      const divs = [...new Set((pg.vlines ?? []).filter((v) => v.x > h.x0 + 3 && v.x < h.x1 - 3 && v.y0 <= h.y + 2 && v.y1 >= h.y - 4 && v.y1 - v.y0 <= 16).map((v) => Math.round(v.x * 2) / 2))];
      if (divs.length !== 1) continue;
      if ((fields.admissionTime ?? []).some((q) => q.p === p && q.segs && Math.abs(q.x - h.x0) < 3)) continue;
      const wipe = [];
      for (const l2 of pg.lines ?? []) for (const it of l2.items) if (it.s.trim() && it.y >= h.y - 14 && it.y <= h.y + 2 && it.x >= h.x0 - 2 && it.x + it.w <= h.x1 + 2 && /^[HMhm\s:]+$/.test(it.s.trim())) wipe.push({ x: +(it.x - 1).toFixed(1), y: +(it.y - (it.h || 7) - 0.5).toFixed(1), w: +(it.w + 2).toFixed(1), h: +((it.h || 7) + 2).toFixed(1) });
      const edges = [h.x0, divs[0], h.x1];
      const segs = [0, 1].map((k) => ({ x: +edges[k].toFixed(1), w: +(edges[k + 1] - edges[k]).toFixed(1) }));
      const keep = (fields.admissionTime ?? []).filter((q) => !(q.p === p && !q.cells && !q.comb && !q.segs && Math.abs(q.y - l.y) < 6));
      fields.admissionTime = [...keep, { p, x: segs[0].x, y: +(h.y - 1.8).toFixed(1), w: +(h.x1 - h.x0).toFixed(1), segs, ...(wipe.length ? { wipe } : {}), ctx: "date" }];
    }
  });
  // 1a. a date written on a "___ / ___ / ______" line: the day, month and year each go on their own stroke
  for (const key of DATE) {
    (fields[key] ?? []).forEach((s, i, arr) => {
      if (s.cells || s.comb || s.segs) return;
      for (const l of pages[s.p]?.lines ?? []) {
        if (Math.abs(l.y - s.y) > 3) continue;
        const it = l.items.find((q) => /^_{2,}\s*[\/-]\s*_{2,}\s*[\/-]\s*_{2,}\s*$/.test(q.s) && q.x >= s.x - 6 && q.x <= s.x + s.w + 12);
        if (!it) continue;
        const segs = []; const re = /_+/g; let m;
        while ((m = re.exec(it.s))) segs.push({ x: +(it.x + (it.w * m.index) / it.s.length).toFixed(1), w: +((it.w * m[0].length) / it.s.length).toFixed(1) });
        if (segs.length !== 3) continue;
        const wipe = l.items.filter((q) => q !== it && q.s.trim() && q.x >= it.x - 2 && q.x + q.w <= it.x + it.w + 4).map((q) => ({ x: +(q.x - 1).toFixed(1), y: +(q.y - (q.h || 7) - 0.5).toFixed(1), w: +(q.w + 2).toFixed(1), h: +((q.h || 7) + 2).toFixed(1) }));
        arr[i] = { p: s.p, x: segs[0].x, y: +(l.y - 1.5).toFixed(1), w: +(segs[2].x + segs[2].w - segs[0].x).toFixed(1), segs, ...(wipe.length ? { wipe } : {}), ctx: s.ctx, label: s.label };
        break;
      }
    });
  }
  // 1b. a date or time whose boxes sit right after its label, though no answer was found for it
  const SPECS = [
    { key: "dob", re: /date of birth|(^|[^a-z])d\.?o\.?b([^a-z]|$)/i, kind: "date" },
    { key: "admissionDate", re: /date of admission|admission date/i, kind: "date" },
    { key: "dischargeDate", re: /date of discharge|discharge date/i, kind: "date" },
  ];
  pages.forEach((pg, p) => {
    const pr = prep[p];
    for (const l of pg.lines ?? []) {
      const items = l.items;
      const place = (key, g, boxes) => {
        const list = (fields[key] ||= []);
        if (list.some((q) => q.p === p && q.cells && Math.abs(q.x - boxes[0].x0) < 3 && Math.abs(q.y - (g.y1 - 3)) < 4)) return;
        const keep = list.filter((q) => !(q.p === p && !q.cells && !q.comb && Math.abs(q.y - l.y) < 4));
        fields[key] = [...keep, { ...cellsSpot(pg, p, g, boxes), ctx: "date" }];
      };
      for (const sp of SPECS) {
        if (drop.includes(sp.key)) continue;
        const it = items.find((q) => sp.re.test(q.s));
        if (!it) continue;
        const x1 = it.x + it.w;
        const g = pr.merged.filter((q) => l.y >= q.y0 - 0.8 && l.y <= q.y1 + 1.8 && q.x0 >= x1 - 3 && q.x0 <= x1 + 170).sort((a, b) => a.x0 - b.x0)[0];
        if (!g || g.boxes.length < 6) continue;
        place(sp.key, g, pickBoxes(pg, g.boxes, [6, 8, 10], g.boxes.slice(0, g.boxes.length >= 10 ? 10 : g.boxes.length >= 8 ? 8 : 6)));
      }
      // the time after the admission date, on the same line
      const adm = items.find((q) => /date of admission|admission date/i.test(q.s));
      const tm = adm && items.find((q) => q.x > adm.x + adm.w && /(^|[^a-z])time([^a-z]|$)/i.test(q.s));
      if (tm && !drop.includes("admissionTime")) {
        const x1 = tm.x + tm.w;
        const g = pr.merged.filter((q) => l.y >= q.y0 - 0.8 && l.y <= q.y1 + 1.8 && q.x0 >= x1 - 3 && q.x0 <= x1 + 90).sort((a, b) => a.x0 - b.x0)[0];
        if (g && g.boxes.length >= 4) place("admissionTime", g, pickBoxes(pg, g.boxes, [4], g.boxes.slice(0, g.boxes.length >= 6 ? 4 : g.boxes.length)));
      }
    }
  });
  // 2. tick boxes and radio circles
  const find = (key, words, need) => {
    const rows = [];
    pages.forEach((pg, p) => {
      const toks = [];
      for (const l of pg.lines ?? []) for (const it of l.items) {
        const re = new RegExp(`\\b(${Object.values(words).map((w) => w.source).join("|")})\\b`, "gi");
        let m;
        while ((m = re.exec(it.s))) {
          const name = Object.keys(words).find((n) => new RegExp(`^(${words[n].source})$`, "i").test(m[0]));
          if (!name) continue;
          toks.push({ name, src: it.s, x0: it.x + (it.w * m.index) / it.s.length, x1: it.x + (it.w * (m.index + m[0].length)) / it.s.length, y: it.y, h: it.h || 8 });
        }
      }
      if (key === "gender") {
        const words = toks.slice();
        for (const l of pg.lines ?? []) {
          if (!l.items.some((i) => /gender/i.test(i.s))) continue;
          for (const it of l.items) { const t = it.s.trim(); if (t === "M" || t === "F") if (!words.some((q) => Math.abs(q.y - it.y) <= 3)) toks.push({ name: t === "M" ? "Male" : "Female", x0: it.x, x1: it.x + it.w, y: it.y, h: it.h || 8 }); }
        }
      }
      const byRow = [];
      for (const t of toks) { const r = byRow.find((q) => Math.abs(q.y - t.y) <= 3); if (r) r.list.push(t); else byRow.push({ y: t.y, list: [t] }); }
      for (const r of byRow) {
        const names = new Set(r.list.map((t) => t.name));
        if (!need.every((n) => names.has(n))) continue;
        const circ = pg.shapes?.circles ?? [];
        const glyphs = [];
        for (const l of pg.lines ?? []) for (const it of l.items) if (/^[☐□❏❑▢]$/.test(it.s.trim())) { const w = Math.max(it.w, 6.5); glyphs.push({ x0: it.x, x1: it.x + w, cy: it.y - (it.h || 8) * 0.35, w, h: w, round: false }); }
        const shapes = [...(pg.shapes?.squares ?? []).filter((q) => !circ.some((c) => Math.abs(c.cx - (q.x0 + q.x1) / 2) < 3 && Math.abs(c.cy - (q.y0 + q.y1) / 2) < 3)).map((q) => ({ x0: q.x0, x1: q.x1, cy: (q.y0 + q.y1) / 2, w: q.x1 - q.x0, h: q.y1 - q.y0, round: false })), ...glyphs, ...circ.map((c) => ({ x0: c.cx - c.r, x1: c.cx + c.r, cy: c.cy, w: 2 * c.r, h: 2 * c.r, round: true }))]
          .filter((s) => Math.abs(s.cy - (r.y - 3)) <= 7);
        let best = null;
        for (const side of ["right", "left"]) {
          const used = new Set(); let cost = 0, okAll = true; const picks = {};
          for (const t of r.list) {
            let pick = null, pd = 1e9;
            for (const s of shapes) {
              const d = side === "right" ? s.x0 - t.x1 : t.x0 - s.x1;
              if (d >= -2 && d <= 18 && d < pd && !used.has(s)) { pick = s; pd = d; }
            }
            if (!pick) { if (need.includes(t.name)) { okAll = false; break; } continue; }
            used.add(pick); cost += pd; picks[t.name] = pick;
          }
          if (okAll && (!best || cost < best.cost)) best = { cost, picks };
        }
        if (!best) {
          // No box to tick: ring the word itself, where the row says "gender".
          // a placeholder such as "Male / Female" printed in the answer cell is written over, not ringed
          if (r.list.every((t) => (t.src ?? "").includes("/"))) continue;
          if (key !== "gender" || !(pg.lines ?? []).some((l) => Math.abs(l.y - r.y) <= 3 && l.items.some((i) => /gender/i.test(i.s)))) continue;
          const ring = {};
          for (const t of r.list) ring[t.name] = { p, x: +(t.x0 - 1).toFixed(1), y: +(t.y + 1.5).toFixed(1), w: +(t.x1 - t.x0 + 2).toFixed(1), h: +Math.max(8, t.h).toFixed(1), ring: true };
          rows.push(ring);
          continue;
        }
        const entry = {};
        for (const [name, s] of Object.entries(best.picks)) entry[name] = { p, x: +s.x0.toFixed(1), y: +(s.cy + s.h / 2).toFixed(1), w: +s.w.toFixed(1), h: +s.h.toFixed(1), ...(s.round ? { round: true } : {}) };
        rows.push(entry);
      }
    });
    // words ringed on pages that have no boxes (instructions, samples) are left out when the form has real boxes
    const real = rows.filter((r) => !Object.values(r).some((v) => v.ring));
    if (real.length) rows.splice(0, rows.length, ...real);
    if (rows.length && !drop.includes(key)) { refined[key] = rows; delete fields[key]; }
  };
  find("gender", { Male: /male/, Female: /female/, Other: /others?|third gender|transgender/ }, ["Male", "Female"]);
  find("admissionType", { Emergency: /emergency/, Planned: /planned/ }, ["Emergency", "Planned"]);
  return refined;
}
export const _internals = { boxesOf, runsOf, groupRuns };
