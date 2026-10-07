import { notify } from './ui';

// Small fetch helper for the health endpoints: JSON in/out, errors shown as toasts
export async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    notify('Sunucuya bağlanılamadı.', 'error');
    throw new Error('network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    notify(data?.error || 'İşlem başarısız.', 'error');
    throw new Error(data?.error || 'request failed');
  }
  return data;
}

export const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const addDays = (dateStr, delta) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + delta));
};
export const parseDateStr = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const niceDate = (s) => {
  const t = todayStr();
  if (s === t) return 'Bugün';
  if (s === addDays(t, -1)) return 'Dün';
  if (s === addDays(t, 1)) return 'Yarın';
  return parseDateStr(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
};
export const shortDate = (s) => parseDateStr(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
export const fmtNum = (n, digits = 1) => {
  const v = Number(n) || 0;
  return v.toLocaleString('tr-TR', { maximumFractionDigits: digits });
};
export const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
