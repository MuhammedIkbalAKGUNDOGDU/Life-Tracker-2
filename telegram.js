// Telegram bot for fast workout / nutrition entry. Free: no AI, just a text parser and buttons.
// Uses long polling (outbound only), so it needs no webhook, domain or open port.
// Enabled when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Only that chat is served.
const H = require('./health');
const N = require('./notes');

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const CHAT = () => String(process.env.TELEGRAM_CHAT_ID || '');

const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const nf = (n, d = 1) => (Math.round((Number(n) || 0) * 10 ** d) / 10 ** d).toString();
const trDate = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const MEAL_EN = { kahvalti: 'Breakfast', ogle: 'Lunch', aksam: 'Dinner', ara: 'Snack' };

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
  keyboard: [[{ text: '🏋️ Workout' }, { text: '🍽 Food' }], [{ text: '📝 Notes' }, { text: '📊 Today' }], [{ text: '⚖️ Weight' }, { text: '↩️ Undo' }]],
  resize_keyboard: true,
  is_persistent: true
};

const btn = (text, data) => ({ text, callback_data: data });

// ---------- per-chat state (in memory; single user) ----------
let state = { awaiting: null, flow: null, pending: null, food: null, pick: null, last: null, expires: 0 };
const touch = () => { state.expires = Date.now() + 30 * 60 * 1000; };
const resetState = () => { state = { awaiting: null, flow: null, pending: null, food: null, pick: null, last: state.last, expires: 0 }; };

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

// Free format without "x": "bench 20 12" (weight reps), "bench 200 12 3" (weight reps sets),
// several entries per message: "bench 20 1 bench 20 12". Names are checked against the exercise list.
async function parseFreeWorkout(pool, text) {
  const RE = /([^\d\n;,:]+?)\s+(\d+(?:[.,]\d+)?)\s*(?:kg)?\s+(\d+)(?:\s+(\d+))?(?=\s|[,;]|$)/gi;
  const list = await H.allExercises(pool);
  const byName = new Map();
  for (const m of text.matchAll(RE)) {
    const name = m[1].trim();
    if (!name || !H.resolveExercise(list, name).best) continue;
    const repeat = m[4] ? Math.min(parseInt(m[4]), 12) : 1;
    const key = H.norm(name);
    if (!byName.has(key)) byName.set(key, { name, sets: [] });
    for (let i = 0; i < repeat; i++) byName.get(key).sets.push({ weight: num(m[2]), reps: parseInt(m[3]) });
  }
  return [...byName.values()];
}

const UNITS = {
  g: 1, gr: 1, gram: 1, grams: 1, ml: 1, kg: 1000,
  adet: 'serving', porsiyon: 'serving', dilim: 'serving', tane: 'serving',
  piece: 'serving', pieces: 'serving', pcs: 'serving', serving: 'serving', servings: 'serving', slice: 'serving', slices: 'serving'
};
const MEAL_WORDS = {
  kahvalti: 'kahvalti', sabah: 'kahvalti', breakfast: 'kahvalti',
  ogle: 'ogle', ogle_yemegi: 'ogle', lunch: 'ogle',
  aksam: 'aksam', dinner: 'aksam', supper: 'aksam',
  ara: 'ara', atistirmalik: 'ara', snack: 'ara'
};

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
    const unitRe = '(g|gr|gram|grams|kg|ml|adet|porsiyon|dilim|tane|piece|pieces|pcs|serving|servings|slice|slices)';
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
  return `🏋️ <b>${esc(w.title || 'Workout')}</b> (${trDate(date)})\n${lines.join('\n')}\nTotal volume: ${vol.toLocaleString('en-US')} kg`;
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
  let s = `🍽 <b>Nutrition</b>: ${nf(t.kcal, 0)}${tg2.kcal ? ` / ${nf(tg2.kcal, 0)}` : ''} kcal\nProtein ${nf(t.protein)} g · Carbs ${nf(t.carbs)} g · Fat ${nf(t.fat)} g`;
  if (tg2.kcal) s += `\n${tg2.kcal - t.kcal >= 0 ? `Left: ${nf(tg2.kcal - t.kcal, 0)} kcal` : `Over: ${nf(t.kcal - tg2.kcal, 0)} kcal`}${tg2.protein ? ` · Protein left: ${nf(Math.max(0, tg2.protein - t.protein), 0)} g` : ''}`;
  return s;
}

// ---------- help ----------
const HELP = {
  main: () => (
    '<b>Softium Planner Bot</b>\n' +
    'Log workouts, meals and notes in seconds.\n\n' +
    '🏋️ <b>Workout</b> → /workout\n' +
    '🍽 <b>Food</b> → /food\n' +
    '📝 <b>Notes</b> → /notes\n' +
    '⚖️ <b>Weight</b> → /weight 82.4\n' +
    '📊 /today · ↩️ /undo · 🧹 /clear (wipe chat)\n\n' +
    'Tap a section for details and examples 👇'
  ),
  workout: () => (
    '🏋️ <b>Workout</b>\n\n' +
    '<b>How to type a set</b>\n' +
    '<code>bench 80x8</code> = Bench Press, <b>80 kg × 8 reps</b> (1 set)\n' +
    'Format: <code>lift weight x reps</code>. The lift name can be short or an alias (bench, squat, ohp, db bench…).\n\n' +
    '<b>Several sets of the same lift</b>\n' +
    '• <code>bench 80x8 80x8 75x10</code> → 3 sets: 80×8, 80×8, 75×10\n' +
    '• <code>squat 100x5x3</code> → 3 sets of 100 kg × 5 (last number = set count)\n\n' +
    '<b>Several lifts at once</b>\n' +
    '• <code>bench 80x8 80x8, squat 100x5x3</code> (separate with comma, ; or new line)\n\n' +
    '<b>Without the "x"</b>\n' +
    '• <code>bench 80 8</code> → 80 kg × 8\n' +
    '• <code>bench 80 8 3</code> → 3 sets of 80 kg × 8\n' +
    '• <code>bench 20 1 bench 20 12</code> → two entries in one message\n' +
    'Decimals work: <code>bench 82.5x6</code>. "kg" is optional: <code>bench 80kg x 8</code>.\n\n' +
    '<b>What happens next</b>\n' +
    'I show what I understood and ask you to confirm before saving. If the name matches several lifts (e.g. "db"), I ask which one. Sets go to today\'s workout, and you get a 🎉 when you beat your best (estimated 1RM).\n\n' +
    '<b>Look up history</b>\n' +
    '• <code>bench</code> → last 3 sessions\n' +
    '• <code>bench 5</code> or <code>/history bench 5</code> → last 5 sessions (max 10)\n' +
    '(A single number after the name = history; two numbers = a set.)\n\n' +
    '<b>Or use buttons</b>\n' +
    '/workout – pick a lift, adjust weight and reps, tap Save\n\n' +
    '<b>Commands</b>\n' +
    '/workout – log sets with buttons\n' +
    '/history bench 5 – last sessions of a lift\n' +
    '/lastworkout – your most recent workout\n' +
    '/undo – remove the last logged sets'
  ),
  food: () => (
    '🍽 <b>Food</b>\n\n' +
    '<b>How to type it</b>\n' +
    '<code>food amount</code> → <code>tavuk göğsü 200g</code>\n' +
    'Separate several foods with comma, ; or new line:\n' +
    '• <code>tavuk göğsü 200g, pilav 150g</code>\n' +
    '• <code>yumurta 3 adet</code> or <code>3 yumurta</code>\n' +
    '• <code>süt 250 ml</code>\n\n' +
    '<b>Units</b>\n' +
    '• g / gr / gram, kg, ml → exact amount (no unit = grams)\n' +
    '• adet / tane / dilim / porsiyon (piece, serving, slice) → uses the food\'s serving size\n\n' +
    '<b>Choose the meal</b>\n' +
    'Start with the meal and a colon:\n' +
    '• <code>breakfast: yumurta 3 adet, ekmek 60g</code>\n' +
    '• <code>lunch:</code> · <code>dinner:</code> · <code>snack:</code> (Turkish also works: kahvaltı, öğle, akşam, ara)\n' +
    'No meal word? I pick by time of day: before 11 breakfast, until 16 lunch, until 21 dinner, later snack.\n\n' +
    '<b>How foods are found</b>\n' +
    '1. Your saved foods (typo tolerant)\n' +
    '2. Open Food Facts if nothing matches\n' +
    'If several foods match, or you forgot the amount, I show buttons to pick and ask for grams. At the end I show the total kcal and macros and ask you to confirm before saving.\n\n' +
    '<b>Commands</b>\n' +
    '/food – tell me what you ate\n' +
    '/meals – today\'s meals\n' +
    '/macros – calories and protein left today\n' +
    '/undo – remove the last logged food'
  ),
  notes: () => (
    '📝 <b>Notes</b>\n\n' +
    '<b>Add</b>\n' +
    '• <code>note: buy milk</code> or <code>/note buy milk</code>\n' +
    '• <code>/note</code> alone → I ask for the text\n\n' +
    '<b>Manage</b>\n' +
    '/notes – your open notes; tap one to complete it\n' +
    '/completed – also show completed notes\n' +
    'Inside the list: ➕ add · 👁 show/hide completed · 🧹 clear completed\n\n' +
    'The show/hide switch is shared with the web app.'
  )
};

function helpKeyboard(current) {
  const row = [['workout', '🏋️ Workout'], ['food', '🍽 Food'], ['notes', '📝 Notes']]
    .filter(([k]) => k !== current)
    .map(([k, label]) => btn(label, `help:${k}`));
  if (current) row.push(btn('⬅️ Menu', 'help:main'));
  return { inline_keyboard: [row] };
}

async function sendHelp(section = 'main') {
  const key = HELP[section] ? section : 'main';
  await send(HELP[key](), { reply_markup: helpKeyboard(key === 'main' ? null : key) });
}

async function cmdStart() {
  await send('👋 Hi! I\'m ready. Use the buttons below or type a command.', { reply_markup: MAIN_KEYBOARD });
  await sendHelp('main');
}

// ---------- commands ----------
async function cmdToday(pool) {
  const w = await workoutSummary(pool, H.today());
  const bw = (await pool.query('SELECT weight FROM body_weights WHERE log_date = $1', [H.today()])).rows[0];
  const open = (await N.listNotes(pool)).active.length;
  await send([w || '🏋️ No workout logged today.', await todayAndTotals(pool), bw ? `⚖️ Weight: ${nf(bw.weight)} kg` : null, `📝 ${open} open note${open === 1 ? '' : 's'}`].filter(Boolean).join('\n\n'));
}

async function cmdLastWorkout(pool) {
  const [w] = await H.loadWorkouts(pool, { limit: 1 });
  if (!w) return send('No workouts logged yet.');
  await send((await workoutSummary(pool, w.workout_date)) || 'No workouts logged yet.');
}

async function cmdMacros(pool) {
  await send(await todayAndTotals(pool));
}

async function cmdMeals(pool) {
  const { rows } = await pool.query('SELECT meal, food_name, grams, kcal FROM meal_logs WHERE log_date = $1 ORDER BY id', [H.today()]);
  if (rows.length === 0) return send('🍽 Nothing logged today. Use /food.');
  const parts = [];
  for (const key of ['kahvalti', 'ogle', 'aksam', 'ara']) {
    const items = rows.filter(r => r.meal === key);
    if (!items.length) continue;
    const kcal = items.reduce((a, r) => a + parseFloat(r.kcal), 0);
    parts.push(`<b>${MEAL_EN[key]}</b> · ${nf(kcal, 0)} kcal\n${items.map(r => `• ${esc(r.food_name)} ${nf(parseFloat(r.grams), 0)} g`).join('\n')}`);
  }
  await send(`${parts.join('\n\n')}\n\n${await todayAndTotals(pool)}`);
}

async function cmdUndo(pool) {
  const last = state.last;
  if (last?.type === 'sets' && last.ids.length) {
    await pool.query('DELETE FROM workout_sets WHERE id = ANY($1)', [last.ids]);
    state.last = null;
    return send(`↩️ Removed the last ${last.ids.length} logged set${last.ids.length === 1 ? '' : 's'}.`);
  }
  if (last?.type === 'meals' && last.ids.length) {
    await pool.query('DELETE FROM meal_logs WHERE id = ANY($1)', [last.ids]);
    state.last = null;
    return send(`↩️ Removed the last ${last.ids.length} logged food item${last.ids.length === 1 ? '' : 's'}.`);
  }
  // Nothing remembered (e.g. after a restart): remove whichever was created last
  const s = (await pool.query('SELECT id, created_at FROM workout_sets ORDER BY created_at DESC LIMIT 1')).rows[0];
  const m = (await pool.query('SELECT id, created_at FROM meal_logs ORDER BY created_at DESC LIMIT 1')).rows[0];
  if (!s && !m) return send('Nothing to undo.');
  if (s && (!m || s.created_at > m.created_at)) { await pool.query('DELETE FROM workout_sets WHERE id = $1', [s.id]); return send('↩️ Removed the last set.'); }
  await pool.query('DELETE FROM meal_logs WHERE id = $1', [m.id]);
  return send('↩️ Removed the last food entry.');
}

async function saveBodyWeight(pool, w) {
  if (!(w >= 20 && w <= 400)) return send('Weight must be between 20 and 400 kg. Example: <code>/weight 82.4</code>');
  await pool.query('INSERT INTO body_weights (log_date, weight) VALUES ($1, $2) ON CONFLICT (log_date) DO UPDATE SET weight = EXCLUDED.weight', [H.today(), w]);
  const prev = (await pool.query('SELECT weight FROM body_weights WHERE log_date < $1 ORDER BY log_date DESC LIMIT 1', [H.today()])).rows[0];
  const diff = prev ? w - parseFloat(prev.weight) : null;
  await send(`⚖️ Weight saved: <b>${nf(w)} kg</b>${diff !== null ? ` (${diff >= 0 ? '+' : ''}${nf(diff)} kg vs last entry)` : ''}`);
}

// ---------- workout flows ----------
async function showExerciseHistory(pool, exercise, n = 3) {
  const hist = await H.exerciseHistory(pool, exercise.id, n);
  if (hist.length === 0) {
    return send(`<b>${esc(exercise.name)}</b>\nNo sessions yet.`, { reply_markup: { inline_keyboard: [[btn('➕ Add to today', `ex:add:${exercise.id}`)]] } });
  }
  const lines = hist.map(h => `<b>${trDate(h.date)}</b>: ${esc(H.formatSets(h.sets))}`);
  const stats = await H.exerciseStats(pool, exercise.id);
  const pr = stats.prE1rm ? `\n🏆 Best: ${nf(stats.prWeight?.maxWeight)} kg (est. 1RM ${nf(stats.prE1rm.e1rm)} kg)` : '';
  const sug = H.suggestNext(hist[0].sets);
  await send(
    `<b>${esc(exercise.name)}</b> — last ${hist.length} session${hist.length === 1 ? '' : 's'}\n${lines.join('\n')}${pr}${sug ? `\n💡 Try next: ${sug.weight} kg × ${sug.reps}` : ''}`,
    { reply_markup: { inline_keyboard: [[btn('➕ Add to today', `ex:add:${exercise.id}`), btn('🔁 Copy last session', `ex:copy:${exercise.id}`)]] } }
  );
}

async function startWorkoutMenu(pool) {
  const list = await H.allExercises(pool);
  const top = list.slice(0, 8);
  const rows = [];
  for (let i = 0; i < top.length; i += 2) rows.push(top.slice(i, i + 2).map(e => btn(e.name, `ex:add:${e.id}`)));
  rows.push([btn('✏️ Other lift', 'ex:other')]);
  const summary = await workoutSummary(pool, H.today());
  await send(`${summary ? `${summary}\n\n` : ''}Which lift?`, { reply_markup: { inline_keyboard: rows } });
}

function flowText(f, daySets) {
  return `🏋️ <b>${esc(f.exercise.name)}</b>\nWeight: <b>${nf(f.weight)} kg</b>  ·  Reps: <b>${f.reps}</b>${f.warm ? '  ·  🔥 warm-up' : ''}` +
    `${daySets.length ? `\n\nToday: ${esc(H.formatSets(daySets))}` : ''}`;
}

function flowKeyboard(f) {
  return {
    inline_keyboard: [
      [btn('−5', 'w:-5'), btn('−2.5', 'w:-2.5'), btn('+2.5', 'w:2.5'), btn('+5', 'w:5')],
      [btn('✏️ Type weight', 'w:type'), btn('✏️ Type reps', 'r:type')],
      [btn('−1', 'r:-1'), btn('6', 'r:=6'), btn('8', 'r:=8'), btn('10', 'r:=10'), btn('12', 'r:=12'), btn('+1', 'r:1')],
      [btn(f.warm ? '🔥 Warm-up: on' : '🔥 Warm-up', 'warm'), btn('✅ Save set', 'set:save')],
      [btn('🏁 Finish lift', 'flow:end')]
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
    `${flowText(flow, flow.daySets)}${hist[0] ? `\n\nLast time (${trDate(hist[0].date)}): ${esc(H.formatSets(hist[0].sets))}` : ''}`,
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
  if (!f) return send('Pick a lift first: /workout');
  const before = await bestE1rm(pool, f.exercise.id, H.today());
  const set = await H.addSet(pool, f.weId, { weight: f.weight, reps: f.reps, is_warmup: f.warm });
  f.setIds.push(set.id);
  state.last = { type: 'sets', ids: [set.id] };
  const w = (await H.loadWorkouts(pool, { from: H.today(), to: H.today() }))[0];
  f.daySets = w.exercises.find(e => e.id === f.weId)?.sets || [];
  await refreshFlow();
  const pr = f.warm ? 0 : await checkPR(pool, f.exercise, [{ weight: f.weight, reps: f.reps }], before);
  if (pr) await send(`🎉 <b>New record!</b> ${esc(f.exercise.name)}: est. 1RM ${nf(pr)} kg`);
  f.warm = false;
}

// Parsed text workout -> confirmation card. Lift names that could mean several lifts ("press") ask first.
async function proposeWorkout(pool, items, idx = 0, resolved = []) {
  const list = await H.allExercises(pool);
  for (let i = idx; i < items.length; i++) {
    const it = items[i];
    const r = H.resolveExercise(list, it.name);
    if (r.ambiguous) {
      state.pick = { kind: 'log', items, idx: i, resolved, candidates: r.candidates, name: it.name };
      touch();
      const rows = r.candidates.map(e => [btn(e.name, `lx:${e.id}`)]);
      rows.push([btn(`➕ New lift “${clip(it.name, 24)}”`, 'lx:new')]);
      return send(`Which lift is “<b>${esc(it.name)}</b>”?`, { reply_markup: { inline_keyboard: rows } });
    }
    resolved.push({ exercise: r.best, name: r.best ? r.best.name : it.name.replace(/\b\w/g, c => c.toUpperCase()), sets: it.sets });
  }
  state.pending = { type: 'workout', items: resolved };
  state.pick = null;
  touch();
  const lines = resolved.map(r => `• <b>${esc(r.name)}</b>${r.exercise ? '' : ' <i>(new lift)</i>'}: ${esc(H.formatSets(r.sets.map(s => ({ ...s, is_warmup: false }))))}`);
  await send(`🏋️ Add to today's workout?\n${lines.join('\n')}`, { reply_markup: { inline_keyboard: [[btn('✅ Save', 'pending:ok'), btn('❌ Cancel', 'pending:cancel')]] } });
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
    if (pr) notes.push(`🎉 ${esc(exercise.name)}: new record (est. 1RM ${nf(pr)} kg)`);
  }
  state.last = { type: 'sets', ids };
  await send(`✅ ${ids.length} set${ids.length === 1 ? '' : 's'} saved.${notes.length ? `\n${notes.join('\n')}` : ''}`);
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
    rows.push([btn('⏭ Skip', 'fd:skip')]);
    await send(`Which one is “<b>${esc(item.name)}</b>”?${note}${item.qty === null ? '\n(No amount given, I\'ll ask after you pick.)' : ''}`, { reply_markup: { inline_keyboard: rows } });
    return;
  }
  await finishFood(pool);
}

async function finishFood(pool) {
  const f = state.food;
  if (f.resolved.length === 0) {
    state.food = null;
    return send(`Nothing to save.${f.skipped.length ? ` Not found: ${esc(f.skipped.join(', '))}. You can add it in the app (Health > Nutrition > New).` : ''}`);
  }
  let kcal = 0, p = 0, c = 0, fat = 0;
  const lines = f.resolved.map(r => {
    const m = H.scaleFood(r.food, r.grams);
    kcal += m.kcal; p += m.protein; c += m.carbs; fat += m.fat;
    return `• ${esc(r.food.name)} ${nf(r.grams, 0)} g → ${nf(m.kcal, 0)} kcal`;
  });
  state.pending = { type: 'food' };
  await send(
    `🍽 <b>${MEAL_EN[f.meal]}</b>:\n${lines.join('\n')}\n\nTotal: <b>${nf(kcal, 0)} kcal</b> · P ${nf(p)} · C ${nf(c)} · F ${nf(fat)}${f.skipped.length ? `\n⚠️ Not found: ${esc(f.skipped.join(', '))}` : ''}`,
    { reply_markup: { inline_keyboard: [[btn('✅ Save', 'pending:ok'), btn('❌ Cancel', 'pending:cancel')], ['kahvalti', 'ogle', 'aksam', 'ara'].map(k => btn(f.meal === k ? `• ${MEAL_EN[k]}` : MEAL_EN[k], `meal:${k}`))] } }
  );
}

async function commitFood(pool) {
  const f = state.food;
  const ids = [];
  for (const r of f.resolved) ids.push((await H.logMeal(pool, { date: H.today(), meal: f.meal, food: r.food, grams: r.grams })).id);
  state.last = { type: 'meals', ids };
  state.food = null;
  await send(`✅ ${ids.length} food item${ids.length === 1 ? '' : 's'} saved.\n\n${await todayAndTotals(pool)}`);
}

// ---------- notes ----------
const clip = (t, n = 38) => {
  const one = String(t).replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

// The notes list as one message: tap a note to tick it off. The "show completed" switch is shared with the web app.
async function notesView(pool, forceCompleted = false) {
  const { active, completed } = await N.listNotes(pool);
  const showCompleted = forceCompleted || (await N.getShowCompleted(pool));
  const shownActive = active.slice(0, 15);
  let text = `📝 <b>Notes</b> · ${active.length} open`;
  if (active.length === 0) text += '\n\nNo open notes 🎉';
  else text += '\n\nTap a note to complete it:';
  if (active.length > shownActive.length) text += `\n(… and ${active.length - shownActive.length} more in the app)`;

  const rows = shownActive.map(n => [btn(`⬜ ${clip(n.text)}`, `nt:done:${n.id}`)]);

  if (showCompleted && completed.length) {
    const shownDone = completed.slice(0, 8);
    text += `\n\n✅ <b>Completed</b> (${completed.length})\nTap to reopen:`;
    for (const n of shownDone) rows.push([btn(`✔️ ${clip(n.text)}`, `nt:undo:${n.id}`)]);
    if (completed.length > shownDone.length) text += `\n(… and ${completed.length - shownDone.length} more completed)`;
  } else if (!showCompleted && completed.length) {
    text += `\n\n<i>${completed.length} completed note${completed.length === 1 ? '' : 's'} hidden.</i>`;
  }

  const showFlag = await N.getShowCompleted(pool);
  rows.push([btn('➕ Add note', 'nt:add'), btn(showFlag ? '👁 Hide completed' : '👁 Show completed', 'nt:toggle')]);
  if (showFlag && completed.length) rows.push([btn('🧹 Clear completed', 'nt:clear')]);
  return { text, extra: { reply_markup: { inline_keyboard: rows } } };
}

async function sendNotes(pool, forceCompleted = false) {
  const v = await notesView(pool, forceCompleted);
  await send(v.text, v.extra);
}

async function refreshNotes(pool, messageId) {
  const v = await notesView(pool);
  await edit(messageId, v.text, v.extra);
}

async function addNoteFromText(pool, text) {
  try {
    const note = await N.addNote(pool, text);
    await send(`📝 Note added:\n<i>${esc(clip(note.text, 200))}</i>`, {
      reply_markup: { inline_keyboard: [[btn('✅ Done', `nt:done1:${note.id}`), btn('📝 My notes', 'nt:list')]] }
    });
  } catch (err) {
    await send(`⚠️ ${esc(err.message)}`);
  }
}

function askHistoryLift(name, candidates, n) {
  state.pick = { kind: 'history', n, candidates };
  touch();
  return send(`Which lift do you mean by “<b>${esc(name)}</b>”?`, {
    reply_markup: { inline_keyboard: candidates.map(e => [btn(e.name, `lx:${e.id}`)]) }
  });
}

// ---------- clear chat ----------
// Telegram has no "clear history" call for bots, but message ids in a private chat are sequential:
// delete the ids below the newest one in batches of 100 (ids that don't exist or are too old are skipped).
async function clearChat(upToId) {
  const floor = Math.max(1, upToId - 2000);
  for (let hi = upToId; hi >= floor; hi -= 100) {
    const ids = [];
    for (let id = hi; id > Math.max(floor - 1, hi - 100); id--) ids.push(id);
    try {
      await tg('deleteMessages', { chat_id: CHAT(), message_ids: ids });
    } catch { /* a batch can fail when every message in it is already gone */ }
  }
}

// ---------- dispatch ----------
// Canonical English commands (Turkish names keep working as aliases)
const COMMANDS = {
  start: 'start', help: 'help', yardim: 'help',
  today: 'today', bugun: 'today',
  undo: 'undo', geri: 'undo',
  workout: 'workout', antrenman: 'workout',
  lastworkout: 'lastworkout', last: 'lastworkout', son: 'lastworkout',
  history: 'history', gecmis: 'history',
  food: 'food', yemek: 'food',
  meals: 'meals', ogunler: 'meals',
  macros: 'macros', kalan: 'macros',
  weight: 'weight', kilo: 'weight',
  note: 'note', not: 'note',
  notes: 'notes', notlar: 'notes',
  completed: 'completed', tamamlananlar: 'completed',
  clear: 'clear', temizle: 'clear'
};

// Reply-keyboard buttons (English + the old Turkish labels)
const BUTTONS = {
  '🏋️ Workout': 'workout', '🏋️ Antrenman': 'workout',
  '🍽 Food': 'food', '🍽 Yemek': 'food',
  '📝 Notes': 'notes', '📝 Notlar': 'notes',
  '📊 Today': 'today', '📊 Bugün': 'today',
  '⚖️ Weight': 'weight', '⚖️ Kilo': 'weight',
  '↩️ Undo': 'undo', '↩️ Geri al': 'undo'
};

async function runCommand(pool, cmd, arg) {
  switch (cmd) {
    case 'start': return cmdStart();
    case 'help': return sendHelp(H.norm(arg).split(' ')[0] || 'main');
    case 'today': return cmdToday(pool);
    case 'undo': return cmdUndo(pool);
    case 'workout': return startWorkoutMenu(pool);
    case 'lastworkout': return cmdLastWorkout(pool);
    case 'history': {
      const m = arg.trim().match(/^(.+?)(?:\s+(\d{1,2}))?$/);
      if (!m) return send('Which lift? Example: <code>/history bench 5</code>');
      const n = Math.min(parseInt(m[2]) || 3, 10);
      const r = H.resolveExercise(await H.allExercises(pool), m[1]);
      if (!r.best) return send(`I don't know a lift called “${esc(m[1])}”. Log it once (for example <code>${esc(m[1])} 60x8</code>) and it will be saved.`);
      if (r.ambiguous) return askHistoryLift(m[1], r.candidates, n);
      return showExerciseHistory(pool, r.best, n);
    }
    case 'food':
      if (arg.trim()) {
        const parsed = parseFoodText(arg);
        if (parsed.items.length) return startFood(pool, parsed);
      }
      state.awaiting = 'food';
      touch();
      return send('What did you eat? Example:\n<code>tavuk göğsü 200g, pilav 150g</code>\n<code>breakfast: yumurta 3 adet, ekmek 60g</code>');
    case 'meals': return cmdMeals(pool);
    case 'macros': return cmdMacros(pool);
    case 'weight': {
      const m = arg.match(/(\d{2,3}(?:[.,]\d+)?)/);
      if (m) return saveBodyWeight(pool, num(m[1]));
      state.awaiting = 'bodyweight';
      touch();
      return send('What\'s your weight today? Example: <code>82.4</code>');
    }
    case 'note':
      if (arg.trim()) return addNoteFromText(pool, arg);
      state.awaiting = 'note';
      touch();
      return send('Type your note:');
    case 'notes': return sendNotes(pool);
    case 'completed': return sendNotes(pool, true);
    case 'clear':
      return send('🧹 Clear this chat?\nI\'ll delete the messages from the last 48 hours (Telegram doesn\'t allow deleting older ones). Your workouts, meals and notes stay untouched.', {
        reply_markup: { inline_keyboard: [[btn('🧹 Yes, clear', 'chat:clear'), btn('Cancel', 'chat:cancel')]] }
      });
    default: return null;
  }
}

async function handleText(pool, textRaw) {
  const text = textRaw.trim();

  // Slash commands: /workout, /history bench 5, /note buy milk, /yardım ...
  const slash = text.match(/^\/([A-Za-zçğıöşüÇĞİÖŞÜ_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (slash) {
    const cmd = COMMANDS[H.norm(slash[1])];
    if (cmd) return runCommand(pool, cmd, slash[2] || '');
    return send(`Unknown command /${esc(slash[1])}. Try /help`);
  }
  if (BUTTONS[text]) return runCommand(pool, BUTTONS[text], '');

  // Plain-text shortcuts: "note: buy milk", "weight 82.4"
  const noteAdd = text.match(/^(?:note|not)(?:\s*[:\-–]\s*|\s+)([\s\S]+)$/i);
  if (noteAdd && noteAdd[1].trim()) return addNoteFromText(pool, noteAdd[1]);
  if (/^(?:note|not)$/i.test(text)) return runCommand(pool, 'note', '');
  if (/^(?:notes|notlar)$/i.test(text)) return sendNotes(pool);
  const weightText = text.match(/^(?:weight|kilo)\s*:?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:kg)?$/i) || text.match(/^(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilo)$/i);
  if (weightText) return saveBodyWeight(pool, num(weightText[1]));

  // Waiting for a typed answer
  if (state.awaiting && Date.now() < state.expires) {
    const a = state.awaiting;
    if (a === 'note') { state.awaiting = null; return addNoteFromText(pool, text); }
    if (a === 'bodyweight') { state.awaiting = null; return saveBodyWeight(pool, num(text)); }
    if ((a === 'weight' || a === 'reps') && state.flow) {
      const v = num(text);
      if (!(v >= 0)) return send('Please type a number.');
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
      if (!(v > 0)) return send('Please type the amount in grams.');
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
  const free = await parseFreeWorkout(pool, text);
  if (free.length) return proposeWorkout(pool, free);

  // Exercise history: "bench" / "bench 5"
  const hq = text.match(/^(.+?)(?:\s+(\d{1,2}))?$/);
  if (hq && !/\d/.test(hq[1])) {
    const list = await H.allExercises(pool);
    const r = H.resolveExercise(list, hq[1]);
    const nq = H.norm(hq[1]);
    // only treat plain text as a history request when it clearly names a lift
    if (r.best && (H.norm(r.best.name) === nq || (r.best.aliases || []).some(a => H.norm(a) === nq) || H.norm(r.best.name).startsWith(nq))) {
      const n = Math.min(parseInt(hq[2]) || 3, 10);
      if (r.ambiguous) return askHistoryLift(hq[1], r.candidates, n);
      return showExerciseHistory(pool, r.best, n);
    }
  }

  // Food text
  const food = parseFoodText(text);
  if (food.items.length && (food.meal || /\d/.test(text))) return startFood(pool, food);

  return send('I didn\'t get that 🤔\nTry <code>bench 80x8 80x8</code> or <code>bench 80 8 3</code>, <code>yumurta 3 adet</code>, <code>note: buy milk</code> or <code>/weight 82.4</code>.\nAll commands: /help');
}

async function handleCallback(pool, cb) {
  const data = cb.data || '';
  const msgId = cb.message?.message_id;
  const answer = (text) => tg('answerCallbackQuery', { callback_query_id: cb.id, text }).catch(() => {});

  if (state.expires && Date.now() > state.expires && (data.startsWith('w:') || data.startsWith('r:') || data.startsWith('set:'))) {
    await answer('Session expired. Start again: /workout');
    return;
  }

  if (data.startsWith('lx:')) {
    await answer();
    const pick = state.pick;
    if (!pick) return send('That choice expired. Please type it again.');
    state.pick = null;
    if (pick.kind === 'history') {
      const ex = pick.candidates.find(e => e.id === parseInt(data.slice(3)));
      return ex ? showExerciseHistory(pool, ex, pick.n) : null;
    }
    if (pick.kind === 'log') {
      const it = pick.items[pick.idx];
      const ex = data === 'lx:new' ? null : pick.candidates.find(e => e.id === parseInt(data.slice(3)));
      pick.resolved.push({ exercise: ex, name: ex ? ex.name : it.name.replace(/\b\w/g, c => c.toUpperCase()), sets: it.sets });
      return proposeWorkout(pool, pick.items, pick.idx + 1, pick.resolved);
    }
    return null;
  }

  if (data === 'chat:cancel') {
    await answer('Cancelled');
    return edit(msgId, 'Cancelled. Nothing was deleted.');
  }
  if (data === 'chat:clear') {
    await answer('Clearing…');
    await clearChat(msgId);
    return send('🧹 Chat cleared. Your data is untouched.\nType /help to see what I can do.', { reply_markup: MAIN_KEYBOARD });
  }

  if (data.startsWith('help:')) {
    await answer();
    const section = HELP[data.slice(5)] ? data.slice(5) : 'main';
    return edit(msgId, HELP[section](), { reply_markup: helpKeyboard(section === 'main' ? null : section) });
  }

  if (data.startsWith('nt:')) {
    await answer();
    if (data === 'nt:list') return sendNotes(pool);
    if (data === 'nt:add') {
      state.awaiting = 'note';
      touch();
      return send('Type your note:');
    }
    if (data === 'nt:toggle') {
      await N.setShowCompleted(pool, !(await N.getShowCompleted(pool)));
      return refreshNotes(pool, msgId);
    }
    if (data === 'nt:clear') {
      return edit(msgId, '🧹 Permanently delete all completed notes?', {
        reply_markup: { inline_keyboard: [[btn('Yes, delete', 'nt:clear:yes'), btn('Cancel', 'nt:cancel')]] }
      });
    }
    if (data === 'nt:clear:yes') {
      const n = await N.clearCompleted(pool);
      await send(`🧹 ${n} completed note${n === 1 ? '' : 's'} deleted.`);
      return refreshNotes(pool, msgId);
    }
    if (data === 'nt:cancel') return refreshNotes(pool, msgId);
    if (data.startsWith('nt:done1:')) {
      const note = await N.setDone(pool, parseInt(data.slice(9)), true);
      return edit(msgId, `✅ Done:\n<s>${esc(clip(note ? note.text : '', 200))}</s>`);
    }
    if (data.startsWith('nt:done:')) { await N.setDone(pool, parseInt(data.slice(8)), true); return refreshNotes(pool, msgId); }
    if (data.startsWith('nt:undo:')) { await N.setDone(pool, parseInt(data.slice(8)), false); return refreshNotes(pool, msgId); }
    return null;
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
    return send('Type the lift name (e.g. <code>incline press</code>):');
  }
  if (data.startsWith('ex:copy:')) {
    await answer();
    const id = parseInt(data.slice(8));
    const list = await H.allExercises(pool);
    const ex = list.find(e => e.id === id);
    const hist = await H.exerciseHistory(pool, id, 2);
    const src = hist.find(h => h.date !== H.today()) || hist[0];
    if (!ex || !src) return send('Nothing to copy yet.');
    state.pending = { type: 'workout', items: [{ exercise: ex, name: ex.name, sets: src.sets.map(s => ({ weight: s.weight, reps: s.reps })) }] };
    touch();
    return send(`🔁 Add last session (${trDate(src.date)}) to today?\n• <b>${esc(ex.name)}</b>: ${esc(H.formatSets(src.sets))}`, { reply_markup: { inline_keyboard: [[btn('✅ Save', 'pending:ok'), btn('❌ Cancel', 'pending:cancel')]] } });
  }

  if (data.startsWith('w:') || data.startsWith('r:') || data === 'warm' || data === 'set:save' || data === 'flow:end') {
    if (!state.flow) { await answer('Pick a lift first: /workout'); return; }
    const f = state.flow;
    touch();
    if (data === 'w:type') { await answer(); state.awaiting = 'weight'; return send('Type the weight (kg):'); }
    if (data === 'r:type') { await answer(); state.awaiting = 'reps'; return send('Type the number of reps:'); }
    if (data.startsWith('w:')) { f.weight = Math.max(0, Math.round((f.weight + num(data.slice(2))) * 100) / 100); await answer(); return refreshFlow(); }
    if (data.startsWith('r:=')) { f.reps = parseInt(data.slice(3)); await answer(); return refreshFlow(); }
    if (data.startsWith('r:')) { f.reps = Math.max(0, f.reps + parseInt(data.slice(2))); await answer(); return refreshFlow(); }
    if (data === 'warm') { f.warm = !f.warm; await answer(); return refreshFlow(); }
    if (data === 'set:save') { await answer('Saved ✅'); return saveSetFromFlow(pool); }
    if (data === 'flow:end') {
      await answer();
      const summary = await workoutSummary(pool, H.today());
      state.flow = null;
      await send(`${summary || 'Nothing logged.'}\n\nAdd another lift: /workout`);
      return;
    }
  }

  if (data === 'pending:cancel') {
    await answer('Cancelled');
    state.pending = null; state.food = null;
    return edit(msgId, '❌ Cancelled.');
  }
  if (data === 'pending:ok') {
    await answer('Saving…');
    const p = state.pending;
    state.pending = null;
    if (p?.type === 'workout') { await edit(msgId, '✅ Saving…'); return commitWorkout(pool, p); }
    if (p?.type === 'food' && state.food) { await edit(msgId, '✅ Saving…'); return commitFood(pool); }
    return send('Nothing pending.');
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
      return send(`How many grams of <b>${esc(chosen.name)}</b>?`);
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
          await send('I only understand text for now. Try <code>bench 80x8 80x8</code> or <code>yumurta 3 adet</code>. All commands: /help');
        }
      } else if (update.callback_query) {
        if (String(update.callback_query.message?.chat.id) !== CHAT()) return;
        await handleCallback(pool, update.callback_query);
      }
    } catch (err) {
      console.error('Telegram handler error:', err.message);
      send('⚠️ Something went wrong, please try again.').catch(() => {});
    }
  };

  (async () => {
    try { await tg('deleteWebhook', { drop_pending_updates: false }); } catch { /* ignore */ }
    try {
      await tg('setMyCommands', { commands: [
        { command: 'workout', description: 'Log sets with buttons' },
        { command: 'history', description: 'Last sessions of a lift, e.g. /history bench 5' },
        { command: 'lastworkout', description: 'Your most recent workout' },
        { command: 'food', description: 'Log what you ate' },
        { command: 'meals', description: "Today's meals" },
        { command: 'macros', description: 'Calories and protein left today' },
        { command: 'weight', description: 'Log body weight, e.g. /weight 82.4' },
        { command: 'note', description: 'Add a note, e.g. /note buy milk' },
        { command: 'notes', description: 'Your notes (tap to complete)' },
        { command: 'completed', description: 'Show completed notes too' },
        { command: 'today', description: "Today's summary" },
        { command: 'undo', description: 'Remove the last log' },
        { command: 'clear', description: 'Clear the chat history' },
        { command: 'help', description: 'Help and examples' }
      ] });
      await tg('setMyShortDescription', { short_description: 'Log workouts, meals and notes for Softium Planner.' });
      await tg('setMyDescription', { description: 'Softium Planner assistant.\n\nLog workouts (bench 80x8 80x8), meals (tavuk 200g) and notes (note: buy milk) in seconds, and get payment reminders.\n\nType /help to start.' });
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

module.exports = { start, parseWorkoutText, parseFoodText, _test: { handleText, handleCallback, parseFreeWorkout } };
