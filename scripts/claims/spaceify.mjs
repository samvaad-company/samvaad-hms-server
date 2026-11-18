const DICT = `a an the of in to by and or if for on at as is it no not name names policy number certificate sl si company tpa id address city state pin code phone email mail e mail details detail primary insured person hospitalized hospitalised hospitalization hospitalisation hospital section part claim form date birth gender male female other others age years months relationship self spouse child father mother occupation service employed homemaker student retired room category occupied day care single occupancy twin sharing beds bed per icu due injury illness maternity admission admitted discharge discharged time system medicine treatment expenses expense claimed pre post total amount bank account branch ifsc pan signature place declaration doctor doctors treating registration reg diagnosis ailment diagnosed nature proposed line were was you your have has been currently covered any mediclaim health insurance history commencement first without break yes last four since inception contract previously lump sum cash benefit checklist documents submitted bills enclosed network non type rohini facilities available ot ward patient patients member card employee corporate mobile telephone contact tel fax office residence residential correspondence permanent present current relation proposer policyholder holder death accident road traffic alcohol substance consumption medico legal reported police fir mlc report attached domiciliary lumpsum cheque dd payable favour micr saving current savings holder mr mrs ms dr tick right option specify please date dd mm yyyy hh mm days day hrs hours emergency planned elective surgery surgical procedure operation icd code estimated expected stay duration present ailment past history tpa insurer sum insured sl previous medical practitioner qualification council stamp seal authorised signatory representative undertake declare true correct information furnished information statement attach original copies copy copies receipts prescriptions discharge summary final bill break up main hospitalisation expenses hospital daily preand post hospitalization period diagnostic investigations investigation reports test tests pharmacy ecg ctscan mri usg pathology lab laboratory radiology consultation consultant fees charges charge nursing diet service implants consumables medicines drugs oxygen blood miscellaneous other others`.split(/\s+/).filter(Boolean);
const SET = new Set(DICT);
const MAXW = Math.max(...DICT.map((w) => w.length));
function segment(run) {
  const low = run.toLowerCase(), n = low.length;
  const cost = Array(n + 1).fill(Infinity), prev = Array(n + 1).fill(-1);
  cost[0] = 0;
  for (let i = 0; i < n; i++) {
    if (cost[i] === Infinity) continue;
    for (let L = 1; L <= Math.min(MAXW, n - i); L++) {
      const w = low.slice(i, i + L);
      const c = SET.has(w) ? (L === 1 ? 2.5 : 1) : L === 1 ? 3 : Infinity;
      if (cost[i] + c < cost[i + L]) { cost[i + L] = cost[i] + c; prev[i + L] = i; }
    }
  }
  if (cost[n] === Infinity) return run;
  const parts = []; let j = n;
  while (j > 0) { parts.unshift(run.slice(prev[j], j)); j = prev[j]; }
  // single unknown characters glue to a neighbour so a stray letter doesn't become its own word
  return parts.join(" ");
}
export function spaceify(s) {
  // camelCase and letter/digit boundaries first
  let t = s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])(\d)/g, "$1 $2").replace(/(\d)([A-Za-z])/g, "$1 $2");
  return t.split(/(\s+)/).map((tok) => (/^[A-Za-z]{6,}$/.test(tok) ? segment(tok) : tok)).join("");
}
