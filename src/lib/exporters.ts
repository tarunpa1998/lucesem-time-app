/** Browser-only file exports. Heavy libraries are loaded on demand. */
export interface ExportTable {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const esc = (v: string | number) => String(v).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function exportCsv(t: ExportTable, file: string) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [t.headers, ...t.rows, ...(t.totals ? [t.totals] : [])].map((r) =>
    r.map(cell).join(";"),
  );
  download(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv" }), `${file}.csv`);
}

export function exportHtml(t: ExportTable, file: string) {
  const tr = (r: (string | number)[], tag = "td") =>
    `<tr>${r.map((v) => `<${tag}>${esc(v)}</${tag}>`).join("")}</tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;color:#0f172a}h1{margin:0}p{color:#64748b}
table{border-collapse:collapse;width:100%;margin-top:16px;font-size:13px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
th{background:#f1f5f9}tfoot td{font-weight:700}</style></head><body>
<h1><span style="color:#0ea5e9">luce</span>sem® · ${esc(t.title)}</h1>${t.subtitle ? `<p>${esc(t.subtitle)}</p>` : ""}
<table><thead>${tr(t.headers, "th")}</thead><tbody>${t.rows.map((r) => tr(r)).join("")}</tbody>
${t.totals ? `<tfoot>${tr(t.totals)}</tfoot>` : ""}</table></body></html>`;
  download(new Blob([html], { type: "text/html" }), `${file}.html`);
}

export async function exportXlsx(t: ExportTable, file: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.addRow([t.title]).font = { bold: true, size: 14 };
  if (t.subtitle) ws.addRow([t.subtitle]);
  ws.addRow([]);
  ws.addRow(t.headers).font = { bold: true };
  t.rows.forEach((r) => ws.addRow(r));
  if (t.totals) ws.addRow(t.totals).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 18));
  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${file}.xlsx`,
  );
}

export async function exportPdf(t: ExportTable, file: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(`lucesem® · ${t.title}`, 14, 16);
  if (t.subtitle) {
    doc.setFontSize(10);
    doc.text(t.subtitle, 14, 23);
  }
  autoTable(doc, {
    startY: 28,
    head: [t.headers],
    body: t.rows.map((r) => r.map(String)),
    ...(t.totals ? { foot: [t.totals.map(String)] } : {}),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [14, 165, 233] },
  });
  doc.save(`${file}.pdf`);
}
