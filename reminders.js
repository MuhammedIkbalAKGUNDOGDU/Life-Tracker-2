// Daily payment reminder over Telegram (optional).
// Enabled when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Sent once a day
// at REMINDER_HOUR (server local time, default 09) and lists overdue + next 3 days.
const API = (token) => `https://api.telegram.org/bot${token}/sendMessage`;

const money = (n) => `${Math.round(n).toLocaleString('en-US')} ₺`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const dayDiff = (d) => {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
};

async function collect(pool, rate) {
  const items = [];

  const tasks = await pool.query(`
    SELECT t.title, t.price - t.paid_price AS remaining, t.due_date, p.title AS project, p.client
    FROM project_tasks t JOIN projects p ON p.id = t.project_id
    WHERE p.type = 'external' AND t.price > t.paid_price AND t.due_date IS NOT NULL
  `);
  for (const r of tasks.rows) {
    items.push({ who: r.client || r.project, what: r.title, amount: parseFloat(r.remaining), due: r.due_date });
  }

  const yearly = await pool.query(`
    SELECT y.title, y.client, y.due_date,
      COALESCE((SELECT SUM(CASE WHEN yi.currency = 'USD' THEN yi.amount * $1 ELSE yi.amount END)
                FROM yearly_payment_items yi WHERE yi.yearly_payment_id = y.id), 0) AS total
    FROM yearly_payments y
    WHERE NOT y.is_paid AND NOT y.is_cancelled AND y.due_date IS NOT NULL
  `, [rate]);
  for (const r of yearly.rows) {
    if (parseFloat(r.total) > 0) items.push({ who: r.client || r.title, what: `${r.title} (yearly)`, amount: parseFloat(r.total), due: r.due_date });
  }
  return items;
}

async function buildMessage(pool) {
  let rate = 34;
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const price = (await res.json()).chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price) rate = price;
  } catch { /* use default rate */ }

  const items = (await collect(pool, rate)).map(i => ({ ...i, diff: dayDiff(i.due) })).filter(i => i.diff <= 3);
  if (items.length === 0) return null;
  items.sort((a, b) => a.diff - b.diff);

  const label = (d) => (d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);
  const lines = items.map(i => `• ${i.who} — ${i.what}: ${money(i.amount)} (${fmtDate(i.due)}, ${label(i.diff)})`);
  const total = items.reduce((s, i) => s + i.amount, 0);
  return `💰 Payment reminder\n\n${lines.join('\n')}\n\nTotal: ${money(total)}`;
}

async function send(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  const res = await fetch(API(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text })
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

function start(pool) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  const hour = parseInt(process.env.REMINDER_HOUR || '9', 10);
  console.log(`🔔 Telegram reminders enabled (daily at ${String(hour).padStart(2, '0')}:00)`);

  const tick = async () => {
    try {
      const now = new Date();
      if (now.getHours() < hour) return;
      const today = now.toISOString().slice(0, 10);
      const last = await pool.query("SELECT value FROM app_state WHERE key = 'reminder_last_sent'");
      if (last.rows[0]?.value === today) return;
      // Mark first so a failure can't spam on every tick
      await pool.query("INSERT INTO app_state (key, value) VALUES ('reminder_last_sent', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [today]);
      const text = await buildMessage(pool);
      if (text) await send(text);
    } catch (err) {
      console.error('Reminder error:', err.message);
    }
  };
  setTimeout(tick, 15000);
  setInterval(tick, 30 * 60 * 1000);
}

module.exports = { start, buildMessage, send };
