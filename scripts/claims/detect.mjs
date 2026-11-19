// Finds where each standard detail goes on a claim form from the printed labels, by section (Part A insured / Part B hospital).
import fs from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const helvDoc = await PDFDocument.create();
const helv = await helvDoc.embedFont(StandardFonts.Helvetica);
const hw = (s, size) => { try { return helv.widthOfTextAtSize(s.replace(/[^\x20-\x7e]/g, "?"), size); } catch { return s.length * size * 0.5; } };

const LEADER = /([_.…\-–\s]{3,}|_+)\s*$/;
/** Words on a line become cells: a printed label, and the leader line (_____ or .....) after it where the answer is written. */
export function cells(line) {
  const out = [];
  const items = [];
  for (const it of line.items) {
    const m = /^(.*?\S)\s+((?:D\s*D\s*M\s*M\s*Y\s*Y(?:\s*Y\s*Y)?|H\s*H\s*:?\s*M\s*M|DD\s*\/\s*MM\s*\/\s*Y+))\s*$/.exec(it.s);
    if (m) {
      const sc = it.w / Math.max(1, hw(it.s, it.h || 9));
      const lw = hw(m[1] + " ", it.h || 9) * sc;
      items.push({ ...it, s: m[1], w: lw - 2 }, { ...it, s: m[2], x: it.x + lw, w: it.w - lw });
    } else items.push(it);
  }
  for (const it of items) {
    if (/^[_.…\-–\s]+$/.test(it.s) && it.s.trim().length >= 2) {
      const c = out[out.length - 1];
      if (c && it.x - (c.leaderEnd ?? c.x1) < 14) c.leaderEnd = Math.max(c.leaderEnd ?? 0, it.x + it.w);
      else out.push({ s: "", x0: it.x, x1: it.x, leaderEnd: it.x + it.w, h: it.h });
      continue;
    }
    const m = LEADER.exec(it.s);
    if (m && m.index > 0 && it.s.slice(0, m.index).trim()) {
      const label = it.s.slice(0, m.index);
      const sc = it.w / Math.max(1, hw(it.s, it.h || 9));
      const lw = hw(label, it.h || 9) * sc;
      const c = out[out.length - 1];
      if (c && !c.leaderEnd && it.x - c.x1 < 7) { c.s += " " + label.trim(); c.x1 = it.x + lw; c.leaderEnd = it.x + it.w; c.h = Math.max(c.h, it.h); }
      else out.push({ s: label.trim(), x0: it.x, x1: it.x + lw, leaderEnd: it.x + it.w, h: it.h });
      continue;
    }
    const c = out[out.length - 1];
    if (c && !c.leaderEnd && it.x - c.x1 < 7) { c.s += (it.x - c.x1 > 0.8 ? " " : "") + it.s; c.x1 = it.x + it.w; c.h = Math.max(c.h, it.h); }
    else out.push({ s: it.s, x0: it.x, x1: it.x + it.w, h: it.h });
  }
  // A cell that holds two enumerated labels ("f) Phone No   g) Email ID") is split at the second.
  const split = [];
  for (const c of out) {
    const re = /\s+(?=(?:[a-z]|[ivx]{1,4})[\).=]\s*[A-Z])/g;
    const idx = [];
    let m; while ((m = re.exec(c.s))) idx.push(m.index);
    if (!idx.length || c.leaderEnd) { split.push(c); continue; }
    const width = c.x1 - c.x0, full = hw(c.s, c.h || 9) || 1;
    let from = 0;
    for (const at of [...idx, c.s.length]) {
      const part = c.s.slice(from, at).trim();
      const px0 = c.x0 + (hw(c.s.slice(0, from), c.h || 9) / full) * width, px1 = c.x0 + (hw(c.s.slice(0, at), c.h || 9) / full) * width;
      if (part) split.push({ s: part, x0: px0, x1: px1, h: c.h });
      from = at;
    }
  }
  return split;
}

const HEAD = [
  ["insured", /details of (the )?(primary )?insured\b(?!.*(person|patient))|details of policy ?holder|personal details of employee|primary insured\s*\(section/i],
  ["history", /details of insurance history/i],
  ["patient", /details of (the )?insured person|details of (the )?patient hospitali[sz]ed|insured person hospitali[sz]ed|person hospitali[sz]ed/i],
  ["hosp", /details of hospitali[sz]ation/i],
  ["claim", /details of (the )?(claim|benefits claimed)\b|details of claim/i],
  ["bills", /details of bills/i],
  ["bank", /primary insured.?s bank|bank account/i],
  ["decl", /declaration by the insured|declaration by insured/i],
  ["hospital", /details of (the )?hospital(?!i[sz])|claim form\s*[-–:]?\s*part\s*[-–:]?\s*b\b|^\W*part\s*[-–:]?\s*b\b(?!.*duly)/i],
  ["patientB", /details of (the )?patient admitted|details of (the )?patient\b(?!.*hospitali)/i],
  ["ailment", /details of ailment|ailment diagnosed/i],
  ["nonnet", /non.?network hospital/i],
  ["checklist", /claim documents submitted|check.?list/i],
];

const HINT = /^(first name|middle name|last name|d\s*d\s*m\s*m\s*y\s*y(?:\s*y\s*y)?|dd\s*[\/\-]?\s*mm\s*[\/\-]?\s*y+|h\s*h\s*:?\s*m\s*m|\(?\s*(years|months|mths|yrs)\s*\)?|\(?(in )?years\)?)$/i;
const SKIP_PAGE = /guidance for filling|policy declaration form/i;

/** key, contexts it is looked for in, and the label wording. */
export const RULES = [
  // ── Part A: policy holder / primary insured ──
  { key: "policyNo", ctx: ["insured"], re: /^(?:policy\s*(no|number|#)|certificate of insurance|policy\/ ?certificate)/i },
  { key: "cardId", ctx: ["insured"], re: /company\s*\/?\s*tpa\s*id|tpa\s*id|member\s*id|health\s*card|uhid/i },
  { key: "employeeId", ctx: ["insured"], re: /employee\s*(id|no|number)/i },
  { key: "insuredName", ctx: ["insured"], re: /^name\b(?!.*(hospital|doctor|bank|company|nominee|corporate|group|employer))/i },
  { key: "address", ctx: ["insured"], re: /^address\b/i },
  { key: "phone", ctx: ["insured"], re: /(mobile|phone|telephone|contact)\s*(no|number|#)?|^tel/i },
  { key: "email", ctx: ["insured"], re: /e-?\s?mail/i },
  { key: "dob", ctx: ["insured"], re: /date of birth|d\.?o\.?b/i },
  { key: "occupation", ctx: ["insured"], re: /occupation/i },
  // ── Part A: the insured person hospitalised ──
  { key: "patientName", ctx: ["patient"], re: /^name\b(?!.*(hospital|doctor|bank|company|nominee|corporate|group|employer))|name of (the )?(patient|claimant|insured person)/i },
  { key: "gender", ctx: ["patient"], re: /gender|^sex/i, choices: true },
  { key: "age", ctx: ["patient"], re: /^age\b|\bage\b.*(year|\()/i },
  { key: "dob", ctx: ["patient"], re: /date of birth|d\.?o\.?b/i },
  { key: "address", ctx: ["patient"], re: /^address\b/i },
  { key: "phone", ctx: ["patient"], re: /(mobile|phone|telephone|contact)\s*(no|number|#)?/i },
  { key: "email", ctx: ["patient"], re: /e-?\s?mail/i },
  { key: "occupation", ctx: ["patient"], re: /occupation/i },
  { key: "cardId", ctx: ["patient"], re: /company\s*\/?\s*tpa\s*id|tpa\s*id|member\s*id|health\s*card|uhid/i },
  { key: "admissionDate", ctx: ["patient", "hosp"], re: /date of admission|admission date/i },
  { key: "dischargeTime", ctx: ["patient", "hosp"], re: /^(?!.*(status|enter|use )).*(time of discharge|discharge time|time discharge)/i },
  { key: "admissionTime", ctx: ["patient", "hosp"], re: /time of admission|^time\b|^time\s*:/i },
  { key: "dischargeDate", ctx: ["patient", "hosp"], re: /date of discharge|discharge date/i },
  { key: "hospitalName", ctx: ["hosp"], re: /name (and address )?of (the )?hospital|hospital\s*name|^name of hospital/i },
  { key: "roomType", ctx: ["hosp"], re: /room\s*category|category of room|room type/i },
  { key: "diagnosis", ctx: ["hosp", "claim"], re: /^(?:diagnosis|nature of (illness|disease))/i },
  { key: "totalBill", ctx: ["claim"], re: /^(?:[ixv]+\.?\s*)?total\b/i },
  // ── Part B ──
  { key: "hospitalName", ctx: ["hospital"], re: /name of (the )?hospital|hospital\s*name/i },
  { key: "rohini", ctx: ["hospital"], re: /rohini|hospital\s*id/i },
  { key: "hospitalReg", ctx: ["hospital", "nonnet"], re: /^(?!.*(irda|cin)).*(registration|reg\.?\s*no)/i },
  { key: "hospitalAddress", ctx: ["hospital", "nonnet"], re: /^address|address of (the )?hospital/i },
  { key: "hospitalPhone", ctx: ["hospital", "nonnet"], re: /(phone|telephone|contact)\s*(no|number|#)?/i },
  { key: "hospitalEmail", ctx: ["hospital", "nonnet"], re: /e-?\s?mail/i },
  { key: "hospitalPan", ctx: ["hospital", "nonnet"], re: /\bpan\b/i },
  { key: "patientName", ctx: ["patientB"], re: /name of (the )?(patient|insured)|^name\b|patient'?s?\s*name/i },
  { key: "gender", ctx: ["patientB"], re: /gender|^sex/i, choices: true },
  { key: "age", ctx: ["patientB"], re: /^age\b|\bage\b.*(year|\()/i },
  { key: "dob", ctx: ["patientB"], re: /date of birth|d\.?o\.?b/i },
  { key: "admissionDate", ctx: ["patientB"], re: /date of admission|admission date/i },
  { key: "dischargeTime", ctx: ["patientB"], re: /^(?!.*(status|enter|use )).*(time of discharge|discharge time|time discharge)/i },
  { key: "admissionTime", ctx: ["patientB"], re: /time of admission|^time\b/i },
  { key: "dischargeDate", ctx: ["patientB"], re: /date of discharge|discharge date/i },
  { key: "roomType", ctx: ["patientB", "ailment"], re: /room\s*category|category of room|room type/i },
  { key: "doctorName", ctx: ["ailment", "patientB", "hospital"], re: /name of (the )?(treating )?(doctor|physician)|treating (doctor|physician)|doctor.?s name/i },
  { key: "doctorReg", ctx: ["ailment", "patientB", "hospital"], re: /(doctor|medical).{0,20}registration|registration (no|number).{0,20}(doctor|council)|council/i },
  { key: "diagnosis", ctx: ["ailment"], re: /diagnosis|nature of (illness|disease)/i },
  { key: "totalBill", ctx: ["ailment", "checklist", "patientB"], re: /^(?:[ixv]+\.?\s*)?(?:total|grand total)\b/i },
];

const norm = (s) => s.replace(/^[\s▪•·\-–*]*(?:\(?[a-zA-Z0-9]{1,4}[\).:]\s+|\(?[a-zA-Z0-9]{1,2}\)\s*)?/, "").trim();

export function detect(pages, overrides = {}) {
  const flat = [];
  pages.forEach((pg, p) => {
    const first = pg.lines.slice(0, 12).map((l) => l.items.map((i) => i.s).join(" ")).join(" ");
    const skip = SKIP_PAGE.test(first) || (p === 0 && /type of claim \(to/i.test(first));
    if (skip) return;
    pg.lines.forEach((l) => flat.push({ p, y: l.y, cs: cells(l), pw: pg.w, ph: pg.h, text: l.items.map((i) => i.s).join(" ").replace(/\s+/g, " ") }));
  });
  const ctxAt = []; let cur = "";
  for (const l of flat) {
    for (const [name, re] of HEAD) if (re.test(l.text) && l.text.length < 130) { cur = name; break; }
    ctxAt.push(cur);
  }
  const fields = {}, choices = {}, used = new Set(), log = [];
  for (const rule of RULES) {
    if (overrides[rule.key] === null) continue;
    let hit = null;
    for (let li = 0; li < flat.length && !hit; li++) {
      if (!rule.ctx.includes(ctxAt[li])) continue;
      const l = flat[li];
      for (let ci = 0; ci < l.cs.length; ci++) {
        const c = l.cs[ci];
        if (!c.s || c.s.length > 110 || used.has(`${li}:${ci}`)) continue;
        if (rule.re.test(norm(c.s))) { hit = { li, ci }; break; }
      }
    }
    if (!hit) { log.push(`${rule.key}[${rule.ctx}] --`); continue; }
    const l = flat[hit.li], c = l.cs[hit.ci];
    // Hint text printed inside the answer box (FIRST NAME, D D M M Y Y Y Y) is wiped and written over.
    let k = hit.ci + 1; const hints = [];
    while (l.cs[k] && HINT.test(l.cs[k].s.trim())) { hints.push(l.cs[k]); k++; }
    // Letters spelled out one to a box (S U R N A M E, F I R S T N A M E) are guide text too.
    if (!hints.length) {
      const run = [];
      for (let j = hit.ci + 1; j < l.cs.length && /^[A-Za-z]$/.test(l.cs[j].s.trim()); j++) run.push(l.cs[j]);
      const word = run.map((q) => q.s.trim().toUpperCase()).join("");
      const m = /^(SURNAME|FIRSTNAME|MIDDLENAME|LASTNAME|NAME)/.exec(word);
      if (m && run.length >= 4) { const take = run.slice(0, m[1].length); hints.push(...take.map((q) => ({ ...q, s: "letter" }))); k = hit.ci + 1 + take.length; }
    }
    // One letter to a box (D D M M Y Y Y Y, H H M M): the answer goes one digit to a box.
    let comb = null;
    if (hints.length === 1 && /^([dmyhDMYH]\s+){3,}[dmyhDMYH]$/.test(hints[0].s.trim())) {
      const hc = hints[0], word = hc.s.replace(/\s+/g, "").toUpperCase(), n = word.length, lw = (hc.h || 8) * 0.62;
      const pitch = (hc.x1 - hc.x0 - lw) / (n - 1);
      if (pitch > 6 && pitch < 30) {
        comb = { pitch: +pitch.toFixed(2), x: +(hc.x0 + lw / 2 - pitch / 2).toFixed(2), n, word, wipe: [...Array(n)].map((_, i) => ({ x: +(hc.x0 + i * pitch - 0.8).toFixed(1), y: +(l.y - (hc.h || 7) - 0.5).toFixed(1), w: +(lw + 1.6).toFixed(1), h: +((hc.h || 7) + 2).toFixed(1) })) };
        hints.length = 0; k = hit.ci + 2;
      }
    }
    if (!hints.length && !comb) {
      const letters = [];
      for (let j = hit.ci + 1; j < l.cs.length && /^[DMYHdmyh]$/.test(l.cs[j].s.trim()); j++) letters.push(l.cs[j]);
      const word = letters.map((q) => q.s.trim().toUpperCase()).join("");
      if (letters.length >= 4 && /^(DDMMYYYY|DDMMYY|HHMM|MMYY|MMYYYY)$/.test(word)) {
        const pitch = (letters[letters.length - 1].x0 - letters[0].x0) / (letters.length - 1);
        comb = { pitch: +pitch.toFixed(2), x: +((letters[0].x0 + letters[0].x1) / 2 - pitch / 2).toFixed(2), n: letters.length, word, wipe: letters.map((q) => ({ x: +(q.x0 - 1).toFixed(1), y: +(l.y - (q.h || 7) - 0.5).toFixed(1), w: +(q.x1 - q.x0 + 2).toFixed(1), h: +((q.h || 7) + 2).toFixed(1) })) };
        k = hit.ci + 1 + letters.length;
      }
    }
    const nx = l.cs[k];
    used.add(`${hit.li}:${hit.ci}`);
    const x0 = hints.length ? Math.min(c.x1 + 3, hints[0].x0 - 1) : c.x1 + 3;
    // The answer goes over the leader line if there is one; otherwise up to the next label on the line, or the page margin.
    let xmax = hints.length ? hints[hints.length - 1].x1 + 2 : c.leaderEnd ? c.leaderEnd : nx && nx.x0 - c.x1 > 20 ? nx.x0 - 3 : l.pw - 28;
    if (!hints.length && nx && nx.x0 >= c.x1 - 0.5 && nx.x0 - 3 < xmax) xmax = nx.x0 - 3;
    const w = xmax - x0;
    // A row of boxes after the label (one letter to a box): found from the form's drawn boxes.
    let boxes = null;
    if (!comb && !hints.length) {
      const pg = pages[l.p], rs = (pg.rects || []).filter((q) => l.y >= q.y - 1 && l.y <= q.y + q.h + 4 && q.x >= c.x1 - 4 && (!nx || q.x < nx.x0 - 1)).sort((a, b) => a.x - b.x);
      const row = [];
      for (const q of rs) {
        const last = row[row.length - 1];
        if (!last) { if (q.x - c.x1 < 60) row.push(q); }
        else if (Math.abs(q.w - last.w) < 3 && q.x - (last.x + last.w) < 18 && q.x > last.x + last.w * 0.5) row.push(q);
        else if (q.x > last.x + last.w) break;
      }
      if (row.length >= 5) boxes = { cells: row.map((q) => +(q.x + q.w / 2).toFixed(1)), cw: row[0].w, x: row[0].x, w: row[row.length - 1].x + row[row.length - 1].w - row[0].x, y: +(row[0].y + row[0].h * 0.5 + 3).toFixed(1) };
    }
    if (boxes) { (fields[rule.key] ||= []).push({ p: l.p, x: boxes.x, y: boxes.y, w: boxes.w, cells: boxes.cells, cw: boxes.cw, label: c.s.slice(0, 40), ctx: ctxAt[hit.li] }); log.push(`${rule.key}[${ctxAt[hit.li]}] BOXES ${boxes.cells.length} p${l.p + 1} y${Math.round(l.y)} x${Math.round(boxes.x)}`); continue; }
    // In a table the answer goes in the cell to the right of the label: just inside the next vertical border, up to the one after it.
    let cell = null;
    if (!comb && !hints.length && !boxes && !c.leaderEnd) {
      const mid = l.y - 3, vs = (pages[l.p].vlines || []).filter((v) => v.y0 - 1 <= mid && v.y1 + 1 >= mid).map((v) => v.x).sort((a, b) => a - b);
      const left = vs.find((x) => x >= c.x1 - 1);
      if (left !== undefined && left - c.x1 < 120) {
        const right = vs.find((x) => x > left + 12);
        cell = { x: left + 3, w: (right ?? Math.min(pages[l.p].w - 20, left + 300)) - left - 5 };
      }
    }
    if (cell && cell.w >= 24) {
      // Guide text printed inside the answer cell (Male/Female, HH/MM) is covered.
      const inner = l.cs.filter((q, qi) => qi > hit.ci && q.s && q.x0 >= cell.x - 3 && q.x1 <= cell.x + cell.w + 3);
      const wipe = inner.map((q) => ({ x: +(q.x0 - 1).toFixed(1), y: +(l.y - (q.h || 7) - 0.5).toFixed(1), w: +(q.x1 - q.x0 + 2).toFixed(1), h: +((q.h || 7) + 2).toFixed(1) }));
      (fields[rule.key] ||= []).push({ p: l.p, x: +cell.x.toFixed(1), y: +(l.y - 0.6).toFixed(1), w: +cell.w.toFixed(1), ...(wipe.length ? { wipe } : {}), label: c.s.slice(0, 40), ctx: ctxAt[hit.li] }); log.push(`${rule.key}[${ctxAt[hit.li]}] CELL p${l.p + 1} y${Math.round(l.y)} x${Math.round(cell.x)} w${Math.round(cell.w)}`); continue; }
    if (comb) { (fields[rule.key] ||= []).push({ p: l.p, x: comb.x, y: +(l.y - 0.6).toFixed(1), w: comb.pitch * comb.n, comb: comb.pitch, wipe: comb.wipe, label: c.s.slice(0, 40), ctx: ctxAt[hit.li] }); log.push(`${rule.key}[${ctxAt[hit.li]}] COMB ${comb.word} p${l.p + 1} y${Math.round(l.y)} x${Math.round(comb.x)}`); continue; }
    if (w < 28 && !hints.length) { log.push(`${rule.key}[${ctxAt[hit.li]}] too narrow (${Math.round(w)}) «${c.s.slice(0, 30)}»`); continue; }
    if (rule.choices) {
      const opts = {};
      for (const q of l.cs.slice(hit.ci + 1)) for (const name of ["Male", "Female", "Other", "Third gender"]) if (new RegExp(`^${name}$`, "i").test(q.s.trim())) opts[name] = { p: l.p, x: q.x0, y: l.y, w: q.x1 - q.x0, h: q.h || 9 };
      if (Object.keys(opts).length) { (choices[rule.key] ||= []).push(opts); log.push(`${rule.key}[${ctxAt[hit.li]}] ring ${Object.keys(opts)}`); continue; }
    }
    (fields[rule.key] ||= []).push({ p: l.p, x: +x0.toFixed(1), y: +(l.y - 0.6).toFixed(1), w: +w.toFixed(1), ...(hints.length ? { wipe: hints.map((h) => ({ x: +(h.x0 - 1).toFixed(1), y: +(l.y - (h.h || 7) - 0.5).toFixed(1), w: +(h.x1 - h.x0 + 2).toFixed(1), h: +((h.h || 7) + 2).toFixed(1) })) } : {}), label: c.s.slice(0, 40), ctx: ctxAt[hit.li] });
    log.push(`${rule.key}[${ctxAt[hit.li]}] p${l.p + 1} y${Math.round(l.y)} x${Math.round(x0)} w${Math.round(w)} «${c.s.slice(0, 36)}»`);
  }
  // A plain answer must not run into a tick box printed on the same line (Day care [ ] Twin sharing [ ]), nor on another detail's place.
  const taken = [];
  for (const [key, spots] of Object.entries(fields)) {
    fields[key] = spots.filter((s) => {
      if (!s.cells && !s.comb) {
        const box = (pages[s.p].rects || []).filter((q) => s.y >= q.y - 1 && s.y <= q.y + q.h + 3 && q.x > s.x + 4 && q.x < s.x + s.w && q.w <= 18 && Math.abs(q.w - q.h) < 5).filter((q, _i, all) => !all.some((o) => o !== q && Math.abs(o.y - q.y) < 1.5 && (Math.abs(o.x - (q.x + q.w)) <= 2.5 || Math.abs(q.x - (o.x + o.w)) <= 2.5))).sort((a, b) => a.x - b.x)[0];
        if (box) { s.w = +(box.x - 2 - s.x).toFixed(1); if (s.w < 28) { log.push(`${key} dropped: tick box on its line`); return false; } }
      }
      const clash = taken.find((t) => t.p === s.p && Math.abs(t.y - s.y) < 4 && t.x < s.x + s.w && s.x < t.x + t.w);
      if (clash) { log.push(`${key} dropped: overlaps ${clash.key}`); return false; }
      taken.push({ key, p: s.p, y: s.y, x: s.x, w: s.w });
      return true;
    });
    if (!fields[key].length) delete fields[key];
  }
  return { fields, choices, log };
}

if (false) {
  const filter = (process.argv[2] || "").toLowerCase();
  for (const f of fs.readdirSync("lines")) {
    if (filter && !f.toLowerCase().includes(filter)) continue;
    const pages = JSON.parse(fs.readFileSync("lines/" + f, "utf8"));
    const { log } = detect(pages);
    console.log("\n=== " + f.replace(".json", ""));
    console.log(log.map((x) => "  " + x).join("\n"));
  }
}
