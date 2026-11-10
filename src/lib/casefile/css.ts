/**
 * The look of the case-file sheets: A4 pages in plain black on white, like the printed sheets kept on the bed. The same rules style the
 * editable sheet on screen, the print window and the pages that become the PDF. Colours are plain hex so the PDF renderer can read them.
 */
export const CASEFILE_CSS = `
.cf, .cf * { box-sizing: border-box; }
.cf { color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.35; }
.cf-page { width: 794px; min-height: 1123px; padding: 26px 32px 30px; background: #ffffff; position: relative; margin: 0 auto; }
.cf-edit .cf-page { min-height: 0; box-shadow: 0 1px 6px rgba(0,0,0,.18); border-radius: 4px; }
.cf-head { border-bottom: 1.5px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
.cf-head .name { font-size: 21px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; }
.cf-head .meta { font-size: 10.5px; color: #333; }
.cf-title { text-align: center; font-weight: 700; font-size: 15px; text-decoration: underline; margin: 8px 0 8px; letter-spacing: .3px; }
.cf-heading { font-weight: 700; font-size: 13px; margin: 10px 0 4px; }
.cf-label { font-weight: 700; margin: 8px 0 0; }
.cf-note { font-size: 11px; margin: 8px 0; }
.cf-pageno { position: absolute; right: 32px; bottom: 12px; font-size: 10px; color: #444; }
.cf-strip { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 4px 0 8px; }
.cf-fields { display: grid; gap: 5px 20px; margin: 6px 0; }
.cf-f { display: flex; align-items: flex-end; gap: 5px; min-width: 0; }
.cf-f .l { font-weight: 700; white-space: nowrap; font-size: 11.5px; }
.cf-f .v { flex: 1; min-width: 0; border-bottom: 1px dotted #333; min-height: 19px; padding: 0 2px; }
.cf-strip .cf-f { flex: 1 1 150px; }
.cf-strip .cf-f.wide { flex: 2 1 280px; }
.cf-strip .cf-f.mid { flex: 1.4 1 200px; }
.cf-dense .cf-fields { gap: 2px 18px; margin: 3px 0; }
.cf-dense .cf-f .v { min-height: 17px; }
.cf-dense .cf-heading { margin: 6px 0 2px; }
.cf-dense .cf-label { margin: 4px 0 0; }
.cf-dense .cf-title { margin: 4px 0; }
.cf-val { white-space: pre-wrap; word-break: break-word; }
.cf-in { width: 100%; border: 0; border-bottom: 1px dotted #888; background: transparent; font: inherit; color: inherit; padding: 1px 2px; outline: none; border-radius: 0; }
.cf-in:focus { background: #eaf3ff; border-bottom-color: #1b6ac9; }
.cf-area { resize: vertical; min-height: 40px; border: 1px dotted #aaa; }
.cf-linesblock { margin: 4px 0 6px; }
.cf-lines { display: block; width: 100%; padding: 0 2px; border: 0; white-space: pre-wrap; word-break: break-word; resize: vertical; background-color: transparent; font: inherit; line-height: var(--lh, 26px);
  background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--lh, 26px) - 1px), #666 calc(var(--lh, 26px) - 1px), #666 var(--lh, 26px)); }
.cf-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 6px 0; }
.cf-table th, .cf-table td { border: 1px solid #111; padding: 2px 5px; vertical-align: top; word-break: break-word; }
.cf-table th { font-weight: 700; text-align: center; font-size: 11.5px; background: #ffffff; vertical-align: middle; }
.cf-table td.c { text-align: center; }
.cf-table td.l { font-weight: 700; font-size: 11.5px; }
.cf-grid td { padding: 0 3px; font-size: 11px; line-height: 1.15; }
.cf-vert { width: 26px; padding: 0 !important; }
.cf-vert div { font-size: 8.5px; line-height: 9px; text-align: center; font-weight: 700; }
.cf-stack .row { display: flex; align-items: flex-end; gap: 4px; margin: 2px 0; min-height: 22px; }
.cf-stack .row b { white-space: nowrap; font-size: 11.5px; }
.cf-stack .row .cf-in, .cf-stack .row .cf-val { flex: 1; min-width: 0; border-bottom: 1px dotted #444; }
.cf-box { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1.3px solid #111; font-weight: 700; line-height: 1; }
.cf-check { width: 15px; height: 15px; }
.cf-yn { display: inline-flex; gap: 4px; }
.cf-yn button { border: 1px solid #999; background: #fff; color: #333; border-radius: 10px; padding: 0 8px; font-size: 11px; cursor: pointer; line-height: 18px; }
.cf-yn button.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.cf-linked { background: #f1f5fb; }
.cf-edit .cf-linked { color: #1c3d6e; }
.cf-print .cf-linked { background: transparent; }
.cf-x { border: 0; background: transparent; cursor: pointer; color: #a33; padding: 2px; }
.cf-src { color: #6b7f9c; font-size: 12px; }
.cf-add { display: inline-flex; align-items: center; gap: 4px; border: 1px dashed #8a9bb5; background: #fff; color: #1b4f9c; border-radius: 14px; padding: 3px 11px; font-size: 12px; cursor: pointer; margin: 2px 0 8px; }
.cf-linkedlist { border-top: 1px dashed #555; padding-top: 6px; }
`;
