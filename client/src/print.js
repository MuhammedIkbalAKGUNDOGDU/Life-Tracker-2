// Printable documents (client statement, project quote). Opens a clean page in a new
// window and calls print(): the browser's "Save as PDF" turns it into a PDF.

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; margin: 40px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #6b7280; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 22px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 8px 6px; }
  td { padding: 9px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .totals { margin-top: 18px; margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .big { border-top: 2px solid #111827; margin-top: 4px; padding-top: 9px; font-weight: 700; font-size: 15px; }
  .paid { color: #047857; }
  .due { color: #b45309; }
  h2 { font-size: 14px; margin: 26px 0 0; }
  @media print { body { margin: 18mm; } }
`;

const openPrint = (title, body) => {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
};

const today = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateText = (d) => (d ? d.toLocaleDateString('tr-TR') : '—');

// Client statement: everything agreed, received and still due for one client
export function printClientStatement(client, fmt) {
  const rows = client.lines.map(l => `
    <tr>
      <td>${esc(l.title)}<div class="muted">${esc(l.projectTitle || (l.source === 'yearly' ? 'Yıllık ödeme' : ''))}</div></td>
      <td>${dateText(l.date)}</td>
      <td class="r">${fmt(l.total)}</td>
      <td class="r paid">${fmt(l.paid)}</td>
      <td class="r due">${fmt(l.remaining)}</td>
    </tr>`).join('');
  const body = `
    <div class="head">
      <div><h1>Hesap Ekstresi</h1><div class="muted">${esc(client.client)}</div></div>
      <div class="muted">${today()}</div>
    </div>
    <table>
      <thead><tr><th>Kalem</th><th>Vade</th><th class="r">Tutar</th><th class="r">Alınan</th><th class="r">Kalan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Toplam</span><span>${fmt(client.total)}</span></div>
      <div class="paid"><span>Alınan</span><span>${fmt(client.paid)}</span></div>
      <div class="big due"><span>Kalan Bakiye</span><span>${fmt(client.remaining)}</span></div>
    </div>`;
  return openPrint(`Ekstre - ${client.client}`, body);
}

// Quote / proposal for a project: its priced tasks and the total
export function printProjectQuote(project, fmt) {
  const tasks = project.tasks || [];
  const total = tasks.reduce((s, t) => s + (parseFloat(t.price) || 0), 0);
  const rows = tasks.map(t => `
    <tr>
      <td>${esc(t.title)}${t.description ? `<div class="muted">${esc(t.description)}</div>` : ''}</td>
      <td class="r">${fmt(parseFloat(t.price) || 0)}</td>
    </tr>`).join('');
  const body = `
    <div class="head">
      <div><h1>Teklif</h1><div class="muted">${esc(project.title)}${project.client ? ` — ${esc(project.client)}` : ''}</div></div>
      <div class="muted">${today()}</div>
    </div>
    ${project.description ? `<p>${esc(project.description)}</p>` : ''}
    <table>
      <thead><tr><th>Kapsam</th><th class="r">Tutar</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><div class="big"><span>Toplam</span><span>${fmt(total)}</span></div></div>`;
  return openPrint(`Teklif - ${project.title}`, body);
}

export function downloadCsv(filename, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + rows.map(r => r.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
