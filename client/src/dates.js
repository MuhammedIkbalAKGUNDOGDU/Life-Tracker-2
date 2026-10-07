// Local-time date helpers (toISOString() is UTC and gives the wrong day around midnight)
const pad = (n) => String(n).padStart(2, '0');
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 'YYYY-MM-DD' (or ISO) -> 'YYYY-MM-DD' without any timezone shift
export const dayString = (value) => {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : localDateStr(d);
};
