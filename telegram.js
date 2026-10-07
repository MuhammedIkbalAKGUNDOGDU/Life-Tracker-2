// Telegram bot for fast workout / nutrition entry. Free: no AI, just a text parser and buttons.
// Uses long polling (outbound only), so it needs no webhook, domain or open port.
// Enabled when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Only that chat is served.
const H = require('./health');

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const CHAT = () => String(process.env.TELEGRAM_CHAT_ID || '');

const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const nf = (n, d = 1) => (Math.round((Number(n) || 0) * 10 ** d) / 10 ** d).toString().replace('.', ',');
const trDate = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

async function tg(method, payload = {}, signal) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(data.description || `Telegram ${res.status}`);
    err.code = data.error_code || res.status;
    throw err;
  }
  return data.result;
}

const send = (text, extra = {}) => tg('sendMessage', { chat_id: CHAT(), text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
const edit = (message_id, text, extra = {}) =>
  tg('editMessageText', { chat_id: CHAT(), message_id, text, parse_mode: 'HTML', ...extra }).catch(() => {}); // "message is not modified" etc.

const MAIN_KEYBOARD = {
  keyboard: [[{ text: '🏋️ Antrenman' }, { text: '🍽 Yemek' }], [{ text: '📊 Bugün' }, { text: '⚖️ Kilo' }], [{ text: '↩️ Geri al' }]],
  resize_keyboard: true,
  is_persistent: true
};

const btn = (text, data) => ({ text, callback_data: data });

// ---------- per-chat state (in memory; single user) ----------
let state = { awaiting: null, flow: null, pending: null, food: null, last: null, expires: 0 };
const touch = () => { state.expires = Date.now() + 30 * 60 * 1000; };
const resetState = () => { state = { awaiting: null, flow: null, pending: null, food: null, last: state.last, expires: 0 }; };

// ---------- parsing ----------
const num = (v) => parseFloat(String(v).replace(',', '.'));

// "bench 80x8 80x8 75x10, squat 100x5x3" -> [{ name, sets: [{weight, reps}] }]
function parseWorkoutText(text) {
  const SET = /(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+))?/gi;
  const chunks = text.split(/[\n;]+/).flatMap(line => line.split(/,\s*(?=[^\d\s])/));
  const items = [];
  for (const chunk of chunks) {
    const matches = [...chunk.matchAll(SET)];
    if (matches.length === 0) continue;
    const name = chunk.slice(0, matches[0].index).replace(/[:\-–]+\s*$/, '').trim();
    if (!name) continue;
    const sets = [];
    for (const m of matches) {
      const repeat = m[3] ? Math.min(parseInt(m[3]), 12) : 1;
      for (let i = 0; i < repeat; i++) sets.push({ weight: num(m[1]), reps: parseInt(m[2]) });
    }
    items.push({ name, sets });
  }
  return items;
}

const UNITS = { g: 1, gr: 1, gram: 1, ml: 1, kg: 1000, adet: 'serving', porsiyon: 'serving', dilim: 'serving', tane: 'serving' };
const MEAL_WORDS = { kahvalti: 'kahvalti', sabah: 'kahvalti', ogle: 'ogle', ogle_yemegi: 'ogle', aksam: 'aksam', ara: 'ara', atistirmalik: 'ara' };

// "kahvaltı: yumurta 3 adet, ekmek 60g" -> { meal, items: [{ name, qty, unit }] }
function parseFoodText(text) {
  let meal = null;
  let body = text;
  const m = text.match(/^\s*([A-Za-zÇĞİÖŞÜçğıöşü ]+?)\s*[:：]\s*(.+)$/s);
  if (m) {
    const key = MEAL_WORDS[H.norm(m[1]).replace(/ /g, '_')];
    if (key) { meal = key; body = m[2]; }
  }
  const items = [];
  for (const part of body.split(/[,\n;]+/).map(p => p.trim()).filter(Boolean)) {
    const unitRe = '(g|gr|gram|kg|ml|adet|porsiyon|dilim|tane)';
    let r = part.match(new RegExp(`^(.*?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${unitRe}?$`, 'i'));
    if (r) { items.push({ name: r[1].trim(), qty: num(r[2]), unit: (r[3] || 'g').toLowerCase() }); continue; }
    r = part.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${unitRe}?\\s+(.+)$`, 'i'));
    if (r) { items.push({ name: r[3].trim(), qty: num(r[1]), unit: (r[2] || 'adet').toLowerCase() }); continue; }
    if (part.length > 1) items.push({ name: part, qty: null, unit: 'g' });
  }
  return { meal, items: items.filter(i => i.name) };
}

const toGrams = (item, food) => {
  const u = UNITS[item.unit] ?? 1;
  if (item.qty === null) return null;
  return u === 'serving' ? item.qty * (Number(food.serving_g) || 100) : item.qty * u;
};

function guessMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'kahvalti' : h < 16 ? 'ogle' : h < 21 ? 'aksam' : 'ara';
}

// ---------- helpers ----------
async function workoutSummary(pool, date) {
  const [w] = await H.loadWorkouts(pool, { from: date, to: date });
  if (!w || w.exercises.length === 0) return null;
  const lines = w.exercises.map(e => `• <b>${esc(e.name)}</b>: ${esc(H.formatSets(e.sets)) || '—'}`);
  const vol = Math.round(w.exercises.flatMap(e => e.sets).filter(s => !s.is_warmup).reduce((a, s) => a + s.weight * s.reps, 0));
  return `🏋️ <b>${esc(w.title || 'Antrenman')}</b> (${trDate(date)})\n${lines.join('\n')}\nToplam hacim: ${vol.toLocaleString('tr-TR')} kg`;
}

async function checkPR(pool, exercise, sets, beforeBest) {
  const best = sets.filter(s => !s.is_warmup).reduce((m, s) => Math.max(m, H.epley(s.weight, s.reps)), 0);
  return beforeBest > 0 && best > beforeBest + 0.05 ? best : 0; // the very first session is not a "record"
}

async function bestE1rm(pool, exerciseId, excludeDate) {
  const hist = await H.exerciseHistory(pool, exerciseId, 500);
  return hist.filter(h => h.date !== excludeDate).reduce((m, h) => Math.max(m, H.summarizeSets(h.sets).e1rm), 0);
}

async function todayAndTotals(pool) {
  const today = H.today();
  const t = await H.dayTotals(pool, today);
  const tg2 = await H.targets(pool);
  let s = `🍽 <b>Beslenme</b>: ${nf(t.kcal, 0)}${tg2.kcal ? ` / ${nf(tg2.kcal, 0)}` : ''} kcal\nP ${nf(t.protein)} g · K ${nf(t.carbs)} g · Y ${nf(t.fat)} g`;
  if (tg2.kcal) s += `\n${tg2.kcal - t.kcal >= 0 ? `Kalan: ${nf(tg2.kcal - t.kcal, 0)} kcal` : `Fazla: ${nf(t.kcal - tg2.kcal, 0)} kcal`}${tg2.protein ? ` · Kalan protein: ${nf(Math.max(0, tg2.protein - t.protein), 0)} g` : ''}`;
  return s;
}

// ---------- commands ----------
async function cmdHelp() {
  await send(
    '<b>Softium Planner botu</b>\n\n' +
    '<b>Antrenman</b>\n' +
    '• Yaz: <code>bench 80x8 80x8 75x10</code>\n' +
    '• Aynı set çok kez: <code>squat 100x5x3</code> (3 set)\n' +
    '• Birden fazla: <code>bench 80x8, squat 100x5x3</code>\n' +
    '• Sadece hareketin adını yaz (<code>bench</code> / <code>bench 5</code>), son seferlerini göster\n' +
    '• 🏋️ Antrenman: düğmelerle set gir\n\n' +
    '<b>Yemek</b>\n' +
    '• <code>kahvaltı: yumurta 3 adet, ekmek 60g</code>\n' +
    '• <code>tavuk göğsü 200g, pilav 150g</code>\n\n' +
    '<b>Diğer</b>\n' +
    '• <code>kilo 82.4</code>\n• /bugun · /son · /kalan · /geri',
    { reply_markup: MAIN_KEYBOARD }
  );
}

async function cmdToday(pool) {
  const w = await workoutSummary(pool, H.today());
  const bw = (await pool.query('SELECT weight FROM body_weights WHERE log_date = $1', [H.today()])).rows[0];
  await send([w || '🏋️ Bugün antrenman kaydı yok.', await todayAndTotals(pool), bw ? `⚖️ Kilo: ${nf(bw.weight)} kg` : null].filter(Boolean).join('\n\n'));
}

async function cmdLast(pool) {
  const [w] = await H.loadWorkouts(pool, { limit: 1 });
  if (!w) return send('Henüz antrenman kaydı yok.');
  await send((await workoutSummary(pool, w.workout_date)) || 'Henüz antrenman kaydı yok.');
}

async function cmdRemaining(pool) {
  await send(await todayAndTotals(pool));
}

async function cmdUndo(pool) {
  const last = state.last;
  if (last?.type === 'sets' && last.ids.length) {
    await pool.query('DELETE FROM workout_sets WHERE id = ANY($1)', [last.ids]);
    state.last = null;
    return send(`↩️ Son kaydedilen ${last.ids.length} set silindi.`);
  }
  if (last?.type === 'meals' && last.ids.length) {
    await pool.query('DELETE FROM meal_logs WHERE id = ANY($1)', [last.ids]);
    state.last = null;
    return send(`↩️ Son eklenen ${last.ids.length} yemek kaydı silindi.`);
  }
  // Nothing remembered (e.g. after a restart): remove whichever was created last
  const s = (await pool.query('SELECT id, created_at FROM workout_sets ORDER BY created_at DESC LIMIT 1')).rows[0];
  const m = (await pool.query('SELECT id, created_at FROM meal_logs ORDER BY created_at DESC LIMIT 1')).rows[0];
  if (!s && !m) return send('Geri alınacak kayıt yok.');
  if (s && (!m || s.created_at > m.created_at)) { await pool.query('DELETE FROM workout_sets WHERE id = $1', [s.id]); return send('↩️ Son set silindi.'); }
  await pool.query('DELETE FROM meal_logs WHERE id = $1', [m.id]);
  return send('↩️ Son yemek kaydı silindi.');
}

async function saveBodyWeight(pool, w) {
  if (!(w >= 20 && w <= 400)) return send('Kilo 20–400 arasında olmalı. Örnek: <code>kilo 82.4</code>');
  await pool.query('INSERT INTO body_weights (log_date, weight) VALUES ($1, $2) ON CONFLICT (log_date) DO UPDATE SET weight = EXCLUDED.weight', [H.today(), w]);
  const prev = (await pool.query('SELECT weight FROM body_weights WHERE log_date < $1 ORDER BY log_date DESC LIMIT 1', [H.today()])).rows[0];
  const diff = prev ? w - parseFloat(prev.weight) : null;
  await send(`⚖️ Kilo kaydedildi: <b>${nf(w)} kg</b>${diff !== null ? ` (${diff >= 0 ? '+' : ''}${nf(diff)} kg, önceki kayda göre)` : ''}`);
}

// ---------- workout flows ----------
async function showExerciseHistory(pool, exercise, n = 3) {
  const hist = await H.exerciseHistory(pool, exercise.id, n);
  if (hist.length === 0) {
    return send(`<b>${esc(exercise.name)}</b>\nHenüz kayıt yok.`, { reply_markup: { inline_keyboard: [[btn('➕ Bugüne ekle', `ex:add:${exercise.id}`)]] } });
  }
  const lines = hist.map(h => `<b>${trDate(h.date)}</b>: ${esc(H.formatSets(h.sets))}`);
  const stats = await H.exerciseStats(pool, exercise.id);
  const pr = stats.prE1rm ? `\n🏆 En iyi: ${nf(stats.prWeight?.maxWeight)} kg (tahmini 1RM ${nf(stats.prE1rm.e1rm)} kg)` : '';
  const sug = H.suggestNext(hist[0].sets);
  await send(
    `<b>${esc(exercise.name)}</b> — son ${hist.length} antrenman\n${lines.join('\n')}${pr}${sug ? `\n💡 Öneri: ${sug.weight} kg × ${sug.reps}` : ''}`,
    { reply_markup: { inline_keyboard: [[btn('➕ Bugüne ekle', `ex:add:${exercise.id}`), btn('🔁 Geçen seferkini kopyala', `ex:copy:${exercise.id}`)]] } }
  );
}

async function startWorkoutMenu(pool) {
  const list = await H.allExercises(pool);
  const top = list.slice(0, 8);
  const rows = [];
  for (let i = 0; i < top.length; i += 2) rows.push(top.slice(i, i + 2).map(e => btn(e.name, `ex:add:${e.id}`)));
  rows.push([btn('✏️ Başka hareket', 'ex:other')]);
  const summary = await workoutSummary(pool, H.today());
  await send(`${summary ? `${summary}\n\n` : ''}Hangi hareket?`, { reply_markup: { inline_keyboard: rows } });
}

function flowText(f, daySets) {
  return `🏋️ <b>${esc(f.exercise.name)}</b>\nAğırlık: <b>${nf(f.weight)} kg</b>  ·  Tekrar: <b>${f.reps}</b>${f.warm ? '  ·  🔥 ısınma' : ''}` +
    `${daySets.length ? `\n\nBugün: ${esc(H.formatSets(daySets))}` : ''}`;
}

function flowKeyboard(f) {
  return {
    inline_keyboard: [
      [btn('−5', 'w:-5'), btn('−2.5', 'w:-2.5'), btn('+2.5', 'w:2.5'), btn('+5', 'w:5')],
      [btn('✏️ Ağırlık yaz', 'w:type'), btn('✏️ Tekrar yaz', 'r:type')],
      [btn('−1', 'r:-1'), btn('6', 'r:=6'), btn('8', 'r:=8'), btn('10', 'r:=10'), btn('12', 'r:=12'), btn('+1', 'r:1')],
      [btn(f.warm ? '🔥 Isınma: açık' : '🔥 Isınma', 'warm'), btn('✅ Seti kaydet', 'set:save')],
      [btn('🏁 Hareketi bitir', 'flow:end')]
    ]
  };
}

async function openFlow(pool, exercise) {
  // "Last time" means before today; fall back to today's sets when there is nothing earlier
  let hist = await H.exerciseHistory(pool, exercise.id, 1, H.today());
  if (hist.length === 0) hist = await H.exerciseHistory(pool, exercise.id, 1);
  const lastSet = hist[0] ? [...hist[0].sets].reverse().find(s => !s.is_warmup) : null;
  const sug = hist[0] ? H.suggestNext(hist[0].sets) : null;
  const workoutId = await H.getOrCreateWorkout(pool, H.today());
  const weId = await H.addExerciseToWorkout(pool, workoutId, exercise.id);
  const existing = (await H.loadWorkouts(pool, { id: workoutId }))[0].exercises.find(e => e.id === weId);
  const flow = { exercise, weId, weight: sug?.weight ?? lastSet?.weight ?? 20, reps: sug?.reps ?? lastSet?.reps ?? 8, warm: false, daySets: existing.sets, messageId: null, setIds: [] };
  state.flow = flow;
  state.awaiting = null;
  touch();
  const m = await send(
    `${flowText(flow, flow.daySets)}${hist[0] ? `\n\nGeçen sefer (${trDate(hist[0].date)}): ${esc(H.formatSets(hist[0].sets))}` : ''}`,
    { reply_markup: flowKeyboard(flow) }
  );
  flow.messageId = m.message_id;
}

async function refreshFlow() {
  const f = state.flow;
  if (!f) return;
  await edit(f.messageId, flowText(f, f.daySets), { reply_markup: flowKeyboard(f) });
}

async function saveSetFromFlow(pool) {
  const f = state.flow;
  if (!f) return send('Önce bir hareket seç: /antrenman');
  const before = await bestE1rm(pool, f.exercise.id, H.today());
  const set = await H.addSet(pool, f.weId, { weight: f.weight, reps: f.reps, is_warmup: f.warm });
  f.setIds.push(set.id);
  state.last = { type: 'sets', ids: [set.id] };
  const w = (await H.loadWorkouts(pool, { from: H.today(), to: H.today() }))[0];
  f.daySets = w.exercises.find(e => e.id === f.weId)?.sets || [];
  await refreshFlow();
  const pr = f.warm ? 0 : await checkPR(pool, f.exercise, [{ weight: f.weight, reps: f.reps }], before);
  if (pr) await send(`🎉 <b>Yeni rekor!</b> ${esc(f.exercise.name)}: tahmini 1RM ${nf(pr)} kg`);
  f.warm = false;
}

// Parsed text workout -> confirmation card
async function proposeWorkout(pool, items) {
  const list = await H.allExercises(pool);
  const resolved = items.map(it => {
    const match = H.matchExercises(list, it.name)[0];
    return { exercise: match || null, name: match ? match.name : it.name.replace(/\b\w/g, c => c.toUpperCase()), sets: it.sets };
  });
  state.pending = { type: 'workout', items: resolved };
  touch();
  const lines = resolved.map(r => `• <b>${esc(r.name)}</b>${r.exercise ? '' : ' <i>(yeni hareket)</i>'}: ${esc(H.formatSets(r.sets.map(s => ({ ...s, is_warmup: false }))))}`);
  await send(`🏋️ Bugünün antrenmanına eklenecek:\n${lines.join('\n')}`, { reply_markup: { inline_keyboard: [[btn('✅ Kaydet', 'pending:ok'), btn('❌ İptal', 'pending:cancel')]] } });
}

async function commitWorkout(pool, pending) {
  const workoutId = await H.getOrCreateWorkout(pool, H.today());
  const ids = [];
  const notes = [];
  for (const r of pending.items) {
    const exercise = r.exercise || (await H.findOrCreateExercise(pool, r.name));
    const before = await bestE1rm(pool, exercise.id, H.today());
    const weId = await H.addExerciseToWorkout(pool, workoutId, exercise.id);
    for (const s of r.sets) ids.push((await H.addSet(pool, weId, s)).id);
    const pr = await checkPR(pool, exercise, r.sets, before);
    if (pr) notes.push(`🎉 ${esc(exercise.name)}: yeni rekor (tahmini 1RM ${nf(pr)} kg)`);
  }
  state.last = { type: 'sets', ids };
  await send(`✅ ${ids.length} set kaydedildi.${notes.length ? `\n${notes.join('\n')}` : ''}`);
}

// ---------- food flow ----------
async function startFood(pool, parsed) {
  const meal = parsed.meal || guessMeal();
  state.food = { meal, items: parsed.items, resolved: [], i: 0, candidates: [], skipped: [] };
  touch();
  await processFood(pool);
}

async function processFood(pool) {
  const f = state.food;
  while (f.i < f.items.length) {
    const item = f.items[f.i];
    const local = await H.searchFoods(pool, item.name, 5);
    const exact = local.find(x => H.norm(x.name) === H.norm(item.name));
    const pick = exact || (local.length === 1 ? local[0] : null);
    if (pick && item.qty !== null) {
      f.resolved.push({ food: pick, grams: toGrams(item, pick) });
      f.i += 1;
      continue;
    }
    // Need the user: ask which food (and how many grams if missing)
    let candidates = local.map(x => ({ ...x }));
    let note = '';
    if (candidates.length === 0) {
      try { candidates = (await H.searchOpenFoodFacts(item.name, 5)); note = ' (Open Food Facts)'; } catch { /* offline */ }
    }
    if (candidates.length === 0) {
      f.skipped.push(item.name);
      f.i += 1;
      continue;
    }
    f.candidates = candidates;
    const rows = candidates.map((c, idx) => [btn(`${c.name}${c.brand ? ` (${c.brand})` : ''} · ${nf(c.kcal, 0)} kcal`, `fd:${idx}`)]);
    rows.push([btn('⏭ Atla', 'fd:skip')]);
    await send(`“<b>${esc(item.name)}</b>” için hangisi?${note}${item.qty === null ? '\n(Gramaj yazmadın, seçince sorarım.)' : ''}`, { reply_markup: { inline_keyboard: rows } });
    return;
  }
  await finishFood(pool);
}

async function finishFood(pool) {
  const f = state.food;
  if (f.resolved.length === 0) {
    state.food = null;
    return send(`Kaydedilecek yemek bulunamadı.${f.skipped.length ? ` Bulunamayan: ${esc(f.skipped.join(', '))}. Uygulamadan elle ekleyebilirsin (Sağlık > Beslenme > Yeni).` : ''}`);
  }
  let kcal = 0, p = 0, c = 0, fat = 0;
  const lines = f.resolved.map(r => {
    const m = H.scaleFood(r.food, r.grams);
    kcal += m.kcal; p += m.protein; c += m.carbs; fat += m.fat;
    return `• ${esc(r.food.name)} ${nf(r.grams, 0)} g → ${nf(m.kcal, 0)} kcal`;
  });
  state.pending = { type: 'food' };
  await send(
    `🍽 <b>${esc(H.MEAL_LABELS[f.meal])}</b> için:\n${lines.join('\n')}\n\nToplam: <b>${nf(kcal, 0)} kcal</b> · P ${nf(p)} · K ${nf(c)} · Y ${nf(fat)}${f.skipped.length ? `\n⚠️ Bulunamadı: ${esc(f.skipped.join(', '))}` : ''}`,
    { reply_markup: { inline_keyboard: [[btn('✅ Kaydet', 'pending:ok'), btn('❌ İptal', 'pending:cancel')], ['kahvalti', 'ogle', 'aksam', 'ara'].map(k => btn(f.meal === k ? `• ${H.MEAL_LABELS[k]}` : H.MEAL_LABELS[k], `meal:${k}`))] } }
  );
}

async function commitFood(pool) {
  const f = state.food;
  const ids = [];
  for (const r of f.resolved) ids.push((await H.logMeal(pool, { date: H.today(), meal: f.meal, food: r.food, grams: r.grams })).id);
  state.last = { type: 'meals', ids };
  state.food = null;
  await send(`✅ ${ids.length} yemek kaydedildi.\n\n${await todayAndTotals(pool)}`);
}

// ---------- dispatch ----------
async function handleText(pool, textRaw) {
  const text = textRaw.trim();
  const lower = H.norm(text);

  // Button / command shortcuts
  if (/^\/(start|yardim|help)\b/.test(text)) return cmdHelp();
  if (/^\/bugun\b/.test(text) || lower === 'bugun' || text === '📊 Bugün') return cmdToday(pool);
  if (/^\/son\b/.test(text)) return cmdLast(pool);
  if (/^\/kalan\b/.test(text)) return cmdRemaining(pool);
  if (/^\/geri\b/.test(text) || text === '↩️ Geri al') return cmdUndo(pool);
  if (/^\/antrenman\b/.test(text) || text === '🏋️ Antrenman') return startWorkoutMenu(pool);
  if (/^\/yemek\b/.test(text) || text === '🍽 Yemek') {
    state.awaiting = 'food';
    touch();
    return send('Ne yedin? Örnek:\n<code>kahvaltı: yumurta 3 adet, ekmek 60g</code>\n<code>tavuk göğsü 200g, pilav 150g</code>');
  }
  const kiloCmd = text.match(/^(?:\/kilo|kilo|⚖️ Kilo)\s*:?\s*(\d{2,3}(?:[.,]\d+)?)?\s*(?:kg)?$/i);
  if (kiloCmd) {
    if (kiloCmd[1]) return saveBodyWeight(pool, num(kiloCmd[1]));
    state.awaiting = 'bodyweight';
    touch();
    return send('Kaç kilosun? Örnek: <code>82.4</code>');
  }
  const kiloAfter = text.match(/^(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilo)$/i);
  if (kiloAfter) return saveBodyWeight(pool, num(kiloAfter[1]));

  // Waiting for a typed number
  if (state.awaiting && Date.now() < state.expires) {
    const a = state.awaiting;
    if (a === 'bodyweight') { state.awaiting = null; return saveBodyWeight(pool, num(text)); }
    if ((a === 'weight' || a === 'reps') && state.flow) {
      const v = num(text);
      if (!(v >= 0)) return send('Bir sayı yaz.');
      if (a === 'weight') state.flow.weight = v; else state.flow.reps = Math.round(v);
      state.awaiting = null;
      return refreshFlow();
    }
    if (a === 'exname') {
      state.awaiting = null;
      const ex = await H.findOrCreateExercise(pool, text);
      return openFlow(pool, ex);
    }
    if (a === 'grams' && state.food) {
      const v = num(text);
      state.awaiting = null;
      if (!(v > 0)) return send('Gramajı sayı olarak yaz.');
      const f = state.food;
      f.resolved.push({ food: f.chosen, grams: v });
      f.i += 1;
      return processFood(pool);
    }
    if (a === 'food') {
      state.awaiting = null;
      const parsed = parseFoodText(text);
      if (parsed.items.length) return startFood(pool, parsed);
    }
  }

  // Workout text: "bench 80x8 80x8"
  const workout = parseWorkoutText(text);
  if (workout.length) return proposeWorkout(pool, workout);

  // Exercise history: "bench" / "bench 5"
  const hq = text.match(/^(.+?)(?:\s+(\d{1,2}))?$/);
  if (hq && !/\d/.test(hq[1])) {
    const list = await H.allExercises(pool);
    const match = H.matchExercises(list, hq[1])[0];
    if (match && (H.norm(match.name) === H.norm(hq[1]) || (match.aliases || []).some(a => H.norm(a) === H.norm(hq[1])) || H.norm(match.name).startsWith(H.norm(hq[1])))) {
      return showExerciseHistory(pool, match, Math.min(parseInt(hq[2]) || 3, 10));
    }
  }

  // Food text
  const food = parseFoodText(text);
  if (food.items.length && (food.meal || /\d/.test(text))) return startFood(pool, food);

  return send('Anlayamadım 🤔\nÖrnek: <code>bench 80x8 80x8</code>, <code>yumurta 3 adet</code>, <code>kilo 82.4</code>\nYardım: /yardim');
}

async function handleCallback(pool, cb) {
  const data = cb.data || '';
  const msgId = cb.message?.message_id;
  const answer = (text) => tg('answerCallbackQuery', { callback_query_id: cb.id, text }).catch(() => {});

  if (state.expires && Date.now() > state.expires && (data.startsWith('w:') || data.startsWith('r:') || data.startsWith('set:'))) {
    await answer('Süre doldu, tekrar başlat: /antrenman');
    return;
  }

  if (data.startsWith('ex:add:')) {
    await answer();
    const list = await H.allExercises(pool);
    const ex = list.find(e => e.id === parseInt(data.slice(7)));
    return ex ? openFlow(pool, ex) : null;
  }
  if (data === 'ex:other') {
    await answer();
    state.awaiting = 'exname';
    touch();
    return send('Hareketin adını yaz (örn. <code>incline press</code>):');
  }
  if (data.startsWith('ex:copy:')) {
    await answer();
    const id = parseInt(data.slice(8));
    const list = await H.allExercises(pool);
    const ex = list.find(e => e.id === id);
    const hist = await H.exerciseHistory(pool, id, 2);
    const src = hist.find(h => h.date !== H.today()) || hist[0];
    if (!ex || !src) return send('Kopyalanacak kayıt yok.');
    state.pending = { type: 'workout', items: [{ exercise: ex, name: ex.name, sets: src.sets.map(s => ({ weight: s.weight, reps: s.reps })) }] };
    touch();
    return send(`🔁 Geçen seferki (${trDate(src.date)}) setler bugüne eklenecek:\n• <b>${esc(ex.name)}</b>: ${esc(H.formatSets(src.sets))}`, { reply_markup: { inline_keyboard: [[btn('✅ Kaydet', 'pending:ok'), btn('❌ İptal', 'pending:cancel')]] } });
  }

  if (data.startsWith('w:') || data.startsWith('r:') || data === 'warm' || data === 'set:save' || data === 'flow:end') {
    if (!state.flow) { await answer('Önce hareket seç: /antrenman'); return; }
    const f = state.flow;
    touch();
    if (data === 'w:type') { await answer(); state.awaiting = 'weight'; return send('Ağırlığı yaz (kg):'); }
    if (data === 'r:type') { await answer(); state.awaiting = 'reps'; return send('Tekrar sayısını yaz:'); }
    if (data.startsWith('w:')) { f.weight = Math.max(0, Math.round((f.weight + num(data.slice(2))) * 100) / 100); await answer(); return refreshFlow(); }
    if (data.startsWith('r:=')) { f.reps = parseInt(data.slice(3)); await answer(); return refreshFlow(); }
    if (data.startsWith('r:')) { f.reps = Math.max(0, f.reps + parseInt(data.slice(2))); await answer(); return refreshFlow(); }
    if (data === 'warm') { f.warm = !f.warm; await answer(); return refreshFlow(); }
    if (data === 'set:save') { await answer('Kaydedildi ✅'); return saveSetFromFlow(pool); }
    if (data === 'flow:end') {
      await answer();
      const summary = await workoutSummary(pool, H.today());
      state.flow = null;
      await send(`${summary || 'Kayıt yok.'}\n\nBaşka hareket eklemek için /antrenman`);
      return;
    }
  }

  if (data === 'pending:cancel') {
    await answer('İptal edildi');
    state.pending = null; state.food = null;
    return edit(msgId, '❌ İptal edildi.');
  }
  if (data === 'pending:ok') {
    await answer('Kaydediliyor…');
    const p = state.pending;
    state.pending = null;
    if (p?.type === 'workout') { await edit(msgId, '✅ Kaydediliyor…'); return commitWorkout(pool, p); }
    if (p?.type === 'food' && state.food) { await edit(msgId, '✅ Kaydediliyor…'); return commitFood(pool); }
    return send('Bekleyen kayıt yok.');
  }
  if (data.startsWith('meal:') && state.food) {
    await answer();
    state.food.meal = data.slice(5);
    return finishFood(pool);
  }
  if (data.startsWith('fd:') && state.food) {
    await answer();
    const f = state.food;
    if (data === 'fd:skip') { f.skipped.push(f.items[f.i].name); f.i += 1; return processFood(pool); }
    let chosen = f.candidates[parseInt(data.slice(3))];
    if (!chosen) return null;
    if (!chosen.id) {
      // Save Open Food Facts result so it is found locally next time
      const dup = chosen.barcode ? (await pool.query('SELECT * FROM foods WHERE barcode = $1', [chosen.barcode])).rows[0] : null;
      chosen = dup || (await H.saveFood(pool, chosen));
    }
    const item = f.items[f.i];
    const grams = toGrams(item, chosen);
    if (grams === null) {
      f.chosen = chosen;
      state.awaiting = 'grams';
      touch();
      return send(`<b>${esc(chosen.name)}</b> kaç gram?`);
    }
    f.resolved.push({ food: chosen, grams });
    f.i += 1;
    return processFood(pool);
  }
  await answer();
}

// ---------- polling loop ----------
function start(pool) {
  if (!TOKEN() || !CHAT()) return;
  console.log('🤖 Telegram bot enabled (long polling)');
  let offset = 0;
  let warnedConflict = false;

  const handle = async (update) => {
    try {
      if (update.message) {
        if (String(update.message.chat.id) !== CHAT()) return; // ignore strangers
        if (update.message.text) {
          if (state.expires && Date.now() > state.expires && state.awaiting) resetState();
          await handleText(pool, update.message.text);
        } else if (update.message.photo || update.message.voice) {
          await send('Şimdilik sadece yazıyı anlıyorum. Örnek: <code>bench 80x8 80x8</code> veya <code>yumurta 3 adet</code>');
        }
      } else if (update.callback_query) {
        if (String(update.callback_query.message?.chat.id) !== CHAT()) return;
        await handleCallback(pool, update.callback_query);
      }
    } catch (err) {
      console.error('Telegram handler error:', err.message);
      send('⚠️ Bir hata oldu, tekrar dene.').catch(() => {});
    }
  };

  (async () => {
    try { await tg('deleteWebhook', { drop_pending_updates: false }); } catch { /* ignore */ }
    try {
      await tg('setMyCommands', { commands: [
        { command: 'antrenman', description: 'Set gir (düğmelerle)' },
        { command: 'yemek', description: 'Yemek ekle' },
        { command: 'bugun', description: 'Bugünün özeti' },
        { command: 'kalan', description: 'Kalan kalori / protein' },
        { command: 'son', description: 'Son antrenman' },
        { command: 'geri', description: 'Son kaydı sil' },
        { command: 'yardim', description: 'Yardım' }
      ] });
    } catch { /* ignore */ }
    for (;;) {
      try {
        const updates = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
        warnedConflict = false;
        for (const u of updates) {
          offset = u.update_id + 1;
          await handle(u);
        }
      } catch (err) {
        if (err.code === 409) {
          if (!warnedConflict) console.error('Telegram: another instance is polling with this bot token (e.g. your local computer). Retrying in 30s.');
          warnedConflict = true;
          await new Promise(r => setTimeout(r, 30000));
        } else {
          console.error('Telegram polling error:', err.message);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
  })();
}

module.exports = { start, parseWorkoutText, parseFoodText, _test: { handleText, handleCallback } };
