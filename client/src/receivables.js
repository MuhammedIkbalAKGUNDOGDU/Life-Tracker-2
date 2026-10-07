// Aggregates every money-in source (project tasks + yearly payments) into one
// normalized list so Home and Alacaklar pages share the same numbers.
// All amounts are normalized to TRY; the UI converts to the display currency.

export const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const NO_CLIENT = 'Müşteri belirtilmemiş';

const toLocalDay = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const diffFromToday = (date) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
};

export const toTry = (amount, currency, usdTryRate) => {
  const amt = parseFloat(amount) || 0;
  return (currency || 'TRY') === 'USD' ? amt * usdTryRate : amt;
};

export function buildReceivables(projects = [], yearlyPayments = [], usdTryRate = 34) {
  const lines = [];

  // One-off income: priced tasks of external projects
  for (const project of projects) {
    if (project.type !== 'external') continue;
    for (const task of project.tasks || []) {
      const total = parseFloat(task.price) || 0;
      if (total <= 0) continue;
      const paid = Math.min(parseFloat(task.paid_price) || 0, total);
      const date = toLocalDay(task.due_date);
      // Collections with their real dates; any older paid amount without history counts on the due date
      const payments = (task.payments || []).map(p => ({ date: toLocalDay(p.paid_date), amount: parseFloat(p.amount) || 0, note: p.note || '' }));
      const historyTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      const legacy = paid - historyTotal;
      const events = legacy > 0.005 ? [{ date, amount: legacy, note: '' }, ...payments] : payments;
      lines.push({
        id: `t-${task.id}`,
        source: 'project',
        client: (project.client || '').trim() || NO_CLIENT,
        title: task.title,
        projectId: project.id,
        projectTitle: project.title,
        total,
        paid,
        remaining: total - paid,
        date,
        diffDays: diffFromToday(date),
        events,
        taskId: task.id
      });
    }
  }

  // Recurring income: yearly payments (renewals, hosting, maintenance...)
  for (const payment of yearlyPayments) {
    if (payment.is_cancelled) continue;
    const total = (payment.items || []).reduce((sum, item) => sum + toTry(item.amount, item.currency, usdTryRate), 0);
    if (total <= 0) continue;
    const paid = payment.is_paid ? total : 0;
    const date = toLocalDay(payment.due_date);
    lines.push({
      id: `y-${payment.id}`,
      source: 'yearly',
      client: (payment.client || payment.project_client || '').trim() || NO_CLIENT,
      title: payment.title,
      projectId: payment.project_id || null,
      projectTitle: payment.project_title || '',
      total,
      paid,
      remaining: total - paid,
      date,
      diffDays: diffFromToday(date),
      events: paid > 0 ? [{ date: toLocalDay(payment.payment_date) || date, amount: paid, note: '' }] : []
    });
  }

  const sum = (arr, key) => arr.reduce((acc, l) => acc + l[key], 0);

  // Per client
  const clientMap = new Map();
  for (const line of lines) {
    if (!clientMap.has(line.client)) clientMap.set(line.client, []);
    clientMap.get(line.client).push(line);
  }
  const byClient = [...clientMap.entries()]
    .map(([client, clientLines]) => ({
      client,
      lines: clientLines.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity)),
      total: sum(clientLines, 'total'),
      paid: sum(clientLines, 'paid'),
      remaining: sum(clientLines, 'remaining'),
      oneTime: sum(clientLines.filter(l => l.source === 'project'), 'total'),
      yearly: sum(clientLines.filter(l => l.source === 'yearly'), 'total')
    }))
    .sort((a, b) => b.remaining - a.remaining || b.total - a.total);

  // Per year / month: money received counts in the month it was collected,
  // money still expected counts in the month it is due.
  const entries = []; // { line, kind: 'paid' | 'pending', amount, date }
  for (const line of lines) {
    for (const ev of line.events) {
      if (ev.date) entries.push({ line, kind: 'paid', amount: ev.amount, date: ev.date });
    }
    if (line.remaining > 0 && line.date) entries.push({ line, kind: 'pending', amount: line.remaining, date: line.date });
  }
  const years = [...new Set(entries.map(e => e.date.getFullYear()))].sort((a, b) => a - b);
  const byYear = {};
  for (const year of years) {
    const months = Array.from({ length: 12 }, (_, m) => ({ month: m, paid: 0, pending: 0, oneTime: 0, yearly: 0, entries: [] }));
    const yearEntries = entries.filter(e => e.date.getFullYear() === year);
    for (const e of yearEntries) {
      const slot = months[e.date.getMonth()];
      slot[e.kind === 'paid' ? 'paid' : 'pending'] += e.amount;
      slot[e.line.source === 'project' ? 'oneTime' : 'yearly'] += e.amount;
      slot.entries.push(e);
    }
    const sumE = (arr) => arr.reduce((acc, e) => acc + e.amount, 0);
    byYear[year] = {
      year,
      months,
      total: sumE(yearEntries),
      paid: sumE(yearEntries.filter(e => e.kind === 'paid')),
      remaining: sumE(yearEntries.filter(e => e.kind === 'pending')),
      oneTime: sumE(yearEntries.filter(e => e.line.source === 'project')),
      yearly: sumE(yearEntries.filter(e => e.line.source === 'yearly'))
    };
  }
  const dated = lines.filter(l => l.date);

  // Reminders: everything still unpaid with a date, soonest first (overdue on top)
  const reminders = dated
    .filter(l => l.remaining > 0)
    .sort((a, b) => a.date - b.date);

  const undated = lines.filter(l => !l.date && l.remaining > 0);

  return {
    lines,
    entries,
    byClient,
    byYear,
    years,
    reminders,
    undated,
    totals: {
      total: sum(lines, 'total'),
      paid: sum(lines, 'paid'),
      remaining: sum(lines, 'remaining'),
      overdue: sum(reminders.filter(l => l.diffDays < 0), 'remaining'),
      next30: sum(reminders.filter(l => l.diffDays >= 0 && l.diffDays <= 30), 'remaining')
    }
  };
}

export const dueLabel = (diffDays) => {
  if (diffDays === null || diffDays === undefined) return 'Vadesiz';
  if (diffDays < 0) return `${Math.abs(diffDays)} gün gecikti`;
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Yarın';
  return `${diffDays} gün sonra`;
};

export const dueColor = (diffDays) => {
  if (diffDays === null || diffDays === undefined) return 'var(--text-muted)';
  if (diffDays < 0) return '#ef4444';
  if (diffDays <= 7) return '#f97316';
  if (diffDays <= 30) return '#eab308';
  return 'var(--success)';
};
