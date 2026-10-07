// Health module: workouts (progressive overload) and nutrition.
// Used by the REST API below and by the Telegram bot (telegram.js).

const norm = (s) =>
  String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pad = (n) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const num = (v, fallback = 0) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const round1 = (n) => Math.round(n * 10) / 10;

const DEFAULT_EXERCISES = [
  ['Bench Press', 'Göğüs', ['bench', 'benç', 'göğüs press', 'bp']],
  ['Incline Bench Press', 'Göğüs', ['incline', 'incline bench', 'eğimli bench', 'üst göğüs']],
  ['Dumbbell Press', 'Göğüs', ['db press', 'dumbbell bench', 'dambıl press']],
  ['Cable Fly', 'Göğüs', ['fly', 'kablo fly', 'crossover']],
  ['Dips', 'Göğüs', ['dip', 'paralel bar']],
  ['Squat', 'Bacak', ['skuat', 'çömelme', 'back squat']],
  ['Leg Press', 'Bacak', ['leg press', 'bacak press']],
  ['Romanian Deadlift', 'Bacak', ['rdl', 'romen deadlift']],
  ['Lunge', 'Bacak', ['lunge', 'hamle']],
  ['Leg Extension', 'Bacak', ['leg ext', 'bacak açma']],
  ['Leg Curl', 'Bacak', ['hamstring curl', 'bacak kıvırma']],
  ['Hip Thrust', 'Bacak', ['hip thrust', 'kalça itiş']],
  ['Calf Raise', 'Bacak', ['kalf', 'baldır']],
  ['Deadlift', 'Sırt', ['dl', 'ölü kaldırış', 'deadlift']],
  ['Barbell Row', 'Sırt', ['row', 'bent over row', 'kürek', 'barbell row']],
  ['Pull-up', 'Sırt', ['barfiks', 'pullup', 'pull up']],
  ['Lat Pulldown', 'Sırt', ['lat pulldown', 'lat çekiş', 'lat']],
  ['Seated Cable Row', 'Sırt', ['cable row', 'oturarak kürek']],
  ['Face Pull', 'Omuz', ['face pull', 'facepull']],
  ['Overhead Press', 'Omuz', ['ohp', 'omuz press', 'military press', 'shoulder press']],
  ['Lateral Raise', 'Omuz', ['yan açış', 'lateral', 'side raise']],
  ['Biceps Curl', 'Kol', ['curl', 'biceps', 'pazu', 'dumbbell curl']],
  ['Hammer Curl', 'Kol', ['hammer', 'çekiç curl']],
  ['Triceps Pushdown', 'Kol', ['pushdown', 'triceps', 'arka kol']],
  ['Skull Crusher', 'Kol', ['skull', 'french press']],
  ['Plank', 'Karın', ['plank']],
  ['Crunch', 'Karın', ['crunch', 'mekik']]
];


// Common foods (approximate values per 100 g, cooked/raw as named). Seeded once so basics work offline.
const SEED_FOODS = [
  // name, kcal, protein, carbs, fat, fiber, sugar, serving_g, serving_label
  ['Tavuk göğsü (çiğ)', 120, 22.5, 0, 2.6, 0, 0, 150, 'porsiyon'],
  ['Tavuk göğsü (haşlanmış / ızgara)', 165, 31, 0, 3.6, 0, 0, 150, 'porsiyon'],
  ['Tavuk but (derisiz, pişmiş)', 177, 24, 0, 8.5, 0, 0, 120, 'porsiyon'],
  ['Hindi göğsü (pişmiş)', 135, 30, 0, 1, 0, 0, 120, 'porsiyon'],
  ['Dana kıyma (pişmiş)', 217, 26, 0, 12, 0, 0, 120, 'porsiyon'],
  ['Dana biftek (ızgara)', 250, 26, 0, 15, 0, 0, 150, 'porsiyon'],
  ['Kuzu eti (pişmiş)', 294, 25, 0, 21, 0, 0, 120, 'porsiyon'],
  ['Somon (pişmiş)', 206, 22, 0, 12, 0, 0, 150, 'porsiyon'],
  ['Ton balığı (konserve, suda)', 116, 26, 0, 1, 0, 0, 80, 'porsiyon'],
  ['Levrek (pişmiş)', 124, 24, 0, 2.6, 0, 0, 150, 'porsiyon'],
  ['Hamsi (pişmiş)', 170, 22, 0, 9, 0, 0, 100, 'porsiyon'],
  ['Yumurta (bütün)', 143, 12.6, 0.7, 9.5, 0, 0.4, 50, 'adet'],
  ['Yumurta akı', 52, 11, 0.7, 0.2, 0, 0.7, 33, 'adet'],
  ['Süt (tam yağlı)', 61, 3.2, 4.8, 3.3, 0, 4.8, 200, 'bardak'],
  ['Süt (yarım yağlı)', 46, 3.4, 4.8, 1.5, 0, 4.8, 200, 'bardak'],
  ['Yoğurt (tam yağlı)', 61, 3.5, 4.7, 3.3, 0, 4.7, 150, 'kase'],
  ['Yoğurt (az yağlı)', 45, 4, 5, 1.5, 0, 5, 150, 'kase'],
  ['Süzme yoğurt', 97, 9, 4, 5, 0, 4, 150, 'kase'],
  ['Ayran', 36, 1.7, 2.8, 1.9, 0, 2.8, 200, 'bardak'],
  ['Beyaz peynir', 264, 14, 1.5, 21, 0, 1, 30, 'dilim'],
  ['Kaşar peyniri', 350, 25, 1.3, 27, 0, 0.5, 30, 'dilim'],
  ['Lor peyniri', 98, 11, 3.4, 4.3, 0, 3, 100, 'porsiyon'],
  ['Tereyağı', 717, 0.9, 0.1, 81, 0, 0.1, 10, 'tatlı kaşığı'],
  ['Zeytinyağı', 884, 0, 0, 100, 0, 0, 14, 'yemek kaşığı'],
  ['Ekmek (beyaz)', 265, 9, 49, 3.2, 2.7, 5, 30, 'dilim'],
  ['Ekmek (tam buğday)', 247, 13, 41, 3.4, 7, 6, 30, 'dilim'],
  ['Pirinç (çiğ)', 360, 7, 79, 0.6, 1.3, 0, 50, 'porsiyon'],
  ['Pilav (pişmiş)', 130, 2.7, 28, 0.3, 0.4, 0, 150, 'porsiyon'],
  ['Bulgur (çiğ)', 342, 12, 76, 1.3, 12.5, 0.4, 50, 'porsiyon'],
  ['Bulgur pilavı (pişmiş)', 83, 3, 19, 0.2, 4.5, 0.1, 150, 'porsiyon'],
  ['Makarna (çiğ)', 371, 13, 75, 1.5, 3.2, 2.7, 80, 'porsiyon'],
  ['Makarna (pişmiş)', 158, 5.8, 31, 0.9, 1.8, 0.6, 200, 'porsiyon'],
  ['Yulaf ezmesi (kuru)', 389, 16.9, 66, 6.9, 10.6, 1, 40, 'porsiyon'],
  ['Patates (haşlanmış)', 87, 1.9, 20, 0.1, 1.8, 0.9, 150, 'adet'],
  ['Tatlı patates (pişmiş)', 90, 2, 21, 0.2, 3.3, 6.5, 150, 'adet'],
  ['Mercimek (pişmiş)', 116, 9, 20, 0.4, 7.9, 1.8, 150, 'porsiyon'],
  ['Nohut (pişmiş)', 164, 8.9, 27, 2.6, 7.6, 4.8, 150, 'porsiyon'],
  ['Kuru fasulye (pişmiş)', 127, 8.7, 23, 0.5, 6.4, 0.3, 150, 'porsiyon'],
  ['Mercimek çorbası', 55, 3, 8, 1.5, 1.5, 1, 250, 'kase'],
  ['Humus', 166, 8, 14, 10, 6, 0.3, 50, 'porsiyon'],
  ['Muz', 89, 1.1, 23, 0.3, 2.6, 12, 120, 'adet'],
  ['Elma', 52, 0.3, 14, 0.2, 2.4, 10, 180, 'adet'],
  ['Portakal', 47, 0.9, 12, 0.1, 2.4, 9, 150, 'adet'],
  ['Mandalina', 53, 0.8, 13, 0.3, 1.8, 11, 80, 'adet'],
  ['Çilek', 32, 0.7, 7.7, 0.3, 2, 4.9, 150, 'kase'],
  ['Üzüm', 69, 0.7, 18, 0.2, 0.9, 15, 100, 'porsiyon'],
  ['Karpuz', 30, 0.6, 7.6, 0.2, 0.4, 6, 250, 'dilim'],
  ['Avokado', 160, 2, 9, 15, 6.7, 0.7, 150, 'adet'],
  ['Domates', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 120, 'adet'],
  ['Salatalık', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 100, 'adet'],
  ['Marul', 15, 1.4, 2.9, 0.2, 1.3, 0.8, 50, 'porsiyon'],
  ['Havuç', 41, 0.9, 10, 0.2, 2.8, 4.7, 70, 'adet'],
  ['Brokoli (pişmiş)', 35, 2.4, 7.2, 0.4, 3.3, 1.4, 100, 'porsiyon'],
  ['Ispanak (pişmiş)', 23, 3, 3.8, 0.3, 2.4, 0.4, 100, 'porsiyon'],
  ['Zeytin (siyah)', 115, 0.8, 6, 11, 3.2, 0, 4, 'adet'],
  ['Badem', 579, 21, 22, 50, 12.5, 4, 28, 'avuç'],
  ['Ceviz', 654, 15, 14, 65, 6.7, 2.6, 28, 'avuç'],
  ['Fındık', 628, 15, 17, 61, 9.7, 4.3, 28, 'avuç'],
  ['Fıstık ezmesi', 588, 25, 20, 50, 6, 9, 16, 'yemek kaşığı'],
  ['Bal', 304, 0.3, 82, 0, 0.2, 82, 20, 'yemek kaşığı'],
  ['Reçel', 250, 0.4, 65, 0.1, 1, 48, 20, 'yemek kaşığı'],
  ['Süt çikolatası', 535, 7.6, 59, 30, 3.4, 52, 20, 'kare'],
  ['Bitter çikolata', 546, 5, 61, 31, 7, 48, 20, 'kare'],
  ['Protein tozu (whey)', 400, 80, 8, 6, 0, 4, 30, 'ölçek'],
  ['Mısır gevreği', 357, 7, 84, 0.4, 3, 8, 30, 'porsiyon'],
  ['Granola', 471, 10, 64, 20, 7, 24, 40, 'porsiyon'],
  ['Kola', 42, 0, 10.6, 0, 0, 10.6, 330, 'kutu'],
  ['Şeker', 387, 0, 100, 0, 0, 100, 5, 'çay kaşığı'],
  ['Çay (şekersiz)', 1, 0, 0.2, 0, 0, 0, 100, 'bardak'],
  ['Kahve (sade)', 2, 0.3, 0, 0, 0, 0, 100, 'fincan']
];

async function seedFoods(pool) {
  const has = await pool.query("SELECT 1 FROM foods WHERE source = 'seed' LIMIT 1");
  if (has.rows[0]) return;
  for (const [name, kcal, protein, carbs, fat, fiber, sugar, serving, label] of SEED_FOODS) {
    await pool.query(
      `INSERT INTO foods (name, kcal, protein, carbs, fat, fiber, sugar, serving_g, serving_label, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'seed')`,
      [name, kcal, protein, carbs, fat, fiber, sugar, serving, label]
    );
  }
}

async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercises (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      muscle VARCHAR(50) DEFAULT '',
      aliases TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
      title VARCHAR(120) DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id SERIAL PRIMARY KEY,
      workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS workout_sets (
      id SERIAL PRIMARY KEY,
      workout_exercise_id INTEGER REFERENCES workout_exercises(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      weight NUMERIC(7, 2) DEFAULT 0,
      reps INTEGER DEFAULT 0,
      rpe NUMERIC(3, 1),
      is_warmup BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS body_weights (
      id SERIAL PRIMARY KEY,
      log_date DATE NOT NULL UNIQUE,
      weight NUMERIC(5, 2) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS foods (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      brand VARCHAR(120) DEFAULT '',
      barcode VARCHAR(40) DEFAULT '',
      kcal NUMERIC(7, 2) DEFAULT 0,
      protein NUMERIC(7, 2) DEFAULT 0,
      carbs NUMERIC(7, 2) DEFAULT 0,
      fat NUMERIC(7, 2) DEFAULT 0,
      fiber NUMERIC(7, 2) DEFAULT 0,
      sugar NUMERIC(7, 2) DEFAULT 0,
      salt NUMERIC(7, 2) DEFAULT 0,
      serving_g NUMERIC(7, 2) DEFAULT 100,
      serving_label VARCHAR(40) DEFAULT 'porsiyon',
      source VARCHAR(20) DEFAULT 'custom',
      use_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS meal_logs (
      id SERIAL PRIMARY KEY,
      log_date DATE NOT NULL DEFAULT CURRENT_DATE,
      meal VARCHAR(20) NOT NULL DEFAULT 'ara',
      food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
      food_name VARCHAR(200) NOT NULL,
      grams NUMERIC(8, 2) NOT NULL,
      kcal NUMERIC(8, 2) DEFAULT 0,
      protein NUMERIC(8, 2) DEFAULT 0,
      carbs NUMERIC(8, 2) DEFAULT 0,
      fat NUMERIC(8, 2) DEFAULT 0,
      fiber NUMERIC(8, 2) DEFAULT 0,
      sugar NUMERIC(8, 2) DEFAULT 0,
      salt NUMERIC(8, 2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS health_settings (
      key VARCHAR(50) PRIMARY KEY,
      value JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(workout_date);
    CREATE INDEX IF NOT EXISTS idx_meal_logs_date ON meal_logs(log_date);
  `);

  await seedFoods(pool);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM exercises');
  if (rows[0].n === 0) {
    for (const [name, muscle, aliases] of DEFAULT_EXERCISES) {
      await pool.query('INSERT INTO exercises (name, muscle, aliases) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [name, muscle, aliases]);
    }
  }
}

// ---------- Exercises ----------

async function allExercises(pool) {
  const { rows } = await pool.query(`
    SELECT e.*, COALESCE(u.uses, 0)::int AS uses, u.last_date
    FROM exercises e
    LEFT JOIN (
      SELECT we.exercise_id, COUNT(*) AS uses, to_char(MAX(w.workout_date), 'YYYY-MM-DD') AS last_date
      FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      GROUP BY we.exercise_id
    ) u ON u.exercise_id = e.id
    ORDER BY u.last_date DESC NULLS LAST, COALESCE(u.uses, 0) DESC, e.name
  `);
  return rows;
}

// Find exercises by (fuzzy) name; best matches first
function matchExercises(list, query) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const e of list) {
    const names = [e.name, ...(e.aliases || [])].map(norm);
    let score = 0;
    if (names.includes(q)) score = 100;
    else if (names.some(n => n.startsWith(q) || q.startsWith(n))) score = 70;
    else if (names.some(n => n.includes(q) || q.includes(n))) score = 50;
    else if (q.split(' ').every(w => names.some(n => n.includes(w)))) score = 30;
    if (score) scored.push({ e, score: score + Math.min(e.uses || 0, 20) / 100 });
  }
  return scored.sort((a, b) => b.score - a.score).map(s => s.e);
}

async function findOrCreateExercise(pool, name, muscle = '') {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Hareket adı gerekli.');
  const list = await allExercises(pool);
  const exact = list.find(e => norm(e.name) === norm(clean) || (e.aliases || []).some(a => norm(a) === norm(clean)));
  if (exact) return exact;
  const { rows } = await pool.query(
    'INSERT INTO exercises (name, muscle) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
    [clean, muscle || '']
  );
  return rows[0];
}

// ---------- Workouts ----------

async function loadWorkouts(pool, { from, to, id, limit } = {}) {
  const where = [];
  const params = [];
  if (id) { params.push(id); where.push(`w.id = $${params.length}`); }
  if (from) { params.push(from); where.push(`w.workout_date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`w.workout_date <= $${params.length}`); }
  params.push(limit || 200);
  const { rows: workouts } = await pool.query(`
    SELECT w.id, to_char(w.workout_date, 'YYYY-MM-DD') AS workout_date, w.title, w.notes, w.created_at
    FROM workouts w ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY w.workout_date DESC, w.id DESC LIMIT $${params.length}
  `, params);
  if (workouts.length === 0) return [];
  const ids = workouts.map(w => w.id);
  const { rows: exs } = await pool.query(`
    SELECT we.id, we.workout_id, we.exercise_id, we.sort_order, we.note, e.name, e.muscle
    FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
    WHERE we.workout_id = ANY($1) ORDER BY we.sort_order, we.id
  `, [ids]);
  const weIds = exs.map(x => x.id);
  const { rows: sets } = weIds.length
    ? await pool.query('SELECT * FROM workout_sets WHERE workout_exercise_id = ANY($1) ORDER BY sort_order, id', [weIds])
    : { rows: [] };
  const setsBy = new Map();
  for (const s of sets) {
    s.weight = parseFloat(s.weight);
    s.rpe = s.rpe === null ? null : parseFloat(s.rpe);
    if (!setsBy.has(s.workout_exercise_id)) setsBy.set(s.workout_exercise_id, []);
    setsBy.get(s.workout_exercise_id).push(s);
  }
  const exBy = new Map();
  for (const x of exs) {
    x.sets = setsBy.get(x.id) || [];
    if (!exBy.has(x.workout_id)) exBy.set(x.workout_id, []);
    exBy.get(x.workout_id).push(x);
  }
  return workouts.map(w => ({ ...w, exercises: exBy.get(w.id) || [] }));
}

async function getOrCreateWorkout(pool, date, title = '') {
  const d = isDate(date) ? date : today();
  const found = await pool.query('SELECT id FROM workouts WHERE workout_date = $1 ORDER BY id DESC LIMIT 1', [d]);
  if (found.rows[0]) return found.rows[0].id;
  const { rows } = await pool.query('INSERT INTO workouts (workout_date, title) VALUES ($1, $2) RETURNING id', [d, title]);
  return rows[0].id;
}

async function addExerciseToWorkout(pool, workoutId, exerciseId) {
  const existing = await pool.query('SELECT id FROM workout_exercises WHERE workout_id = $1 AND exercise_id = $2', [workoutId, exerciseId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await pool.query(`
    INSERT INTO workout_exercises (workout_id, exercise_id, sort_order)
    VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM workout_exercises WHERE workout_id = $1), 0))
    RETURNING id
  `, [workoutId, exerciseId]);
  return rows[0].id;
}

async function addSet(pool, workoutExerciseId, { weight, reps, rpe = null, is_warmup = false }) {
  const { rows } = await pool.query(`
    INSERT INTO workout_sets (workout_exercise_id, sort_order, weight, reps, rpe, is_warmup)
    VALUES ($1, COALESCE((SELECT MAX(sort_order) + 1 FROM workout_sets WHERE workout_exercise_id = $1), 0), $2, $3, $4, $5)
    RETURNING *
  `, [workoutExerciseId, num(weight), Math.max(0, parseInt(reps) || 0), rpe === null || rpe === '' ? null : num(rpe), !!is_warmup]);
  return rows[0];
}

// Past sessions of one exercise (newest first) with their sets
async function exerciseHistory(pool, exerciseId, limit = 5, beforeDate = null) {
  const params = [exerciseId];
  let dateFilter = '';
  if (beforeDate) { params.push(beforeDate); dateFilter = `AND w.workout_date < $${params.length}`; }
  params.push(limit);
  const { rows } = await pool.query(`
    SELECT we.id AS we_id, w.id AS workout_id, to_char(w.workout_date, 'YYYY-MM-DD') AS date, w.title
    FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
    WHERE we.exercise_id = $1 ${dateFilter}
      AND EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_exercise_id = we.id)
    ORDER BY w.workout_date DESC, we.id DESC LIMIT $${params.length}
  `, params);
  if (rows.length === 0) return [];
  const { rows: sets } = await pool.query(
    'SELECT * FROM workout_sets WHERE workout_exercise_id = ANY($1) ORDER BY sort_order, id', [rows.map(r => r.we_id)]
  );
  return rows.map(r => ({
    ...r,
    sets: sets.filter(s => s.workout_exercise_id === r.we_id).map(s => ({ ...s, weight: parseFloat(s.weight), rpe: s.rpe === null ? null : parseFloat(s.rpe) }))
  }));
}

// Last N sessions of every exercise in one go (for the "add exercise" picker)
async function recentSessionsAll(pool, limit = 3, beforeDate = null) {
  const params = [limit];
  let dateFilter = '';
  if (beforeDate) { params.push(beforeDate); dateFilter = `AND w.workout_date < $${params.length}`; }
  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT we.exercise_id, we.id AS we_id, to_char(w.workout_date, 'YYYY-MM-DD') AS date,
             ROW_NUMBER() OVER (PARTITION BY we.exercise_id ORDER BY w.workout_date DESC, we.id DESC) AS rn
      FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      WHERE EXISTS (SELECT 1 FROM workout_sets x WHERE x.workout_exercise_id = we.id) ${dateFilter}
    ) t WHERE rn <= $1 ORDER BY exercise_id, rn
  `, params);
  if (rows.length === 0) return {};
  const { rows: sets } = await pool.query('SELECT * FROM workout_sets WHERE workout_exercise_id = ANY($1) ORDER BY sort_order, id', [rows.map(r => r.we_id)]);
  const out = {};
  for (const r of rows) {
    (out[r.exercise_id] = out[r.exercise_id] || []).push({
      date: r.date,
      sets: sets.filter(x => x.workout_exercise_id === r.we_id).map(x => ({ weight: parseFloat(x.weight), reps: x.reps, rpe: x.rpe === null ? null : parseFloat(x.rpe), is_warmup: x.is_warmup }))
    });
  }
  return out;
}

function summarizeSets(sets) {
  const work = sets.filter(s => !s.is_warmup);
  const best = work.reduce((b, s) => (epley(s.weight, s.reps) > epley(b.weight, b.reps) ? s : b), work[0] || { weight: 0, reps: 0 });
  return {
    volume: Math.round(work.reduce((a, s) => a + s.weight * s.reps, 0)),
    maxWeight: work.reduce((m, s) => Math.max(m, s.weight), 0),
    e1rm: round1(epley(best.weight, best.reps)),
    bestSet: best
  };
}

// Compact "80×8, 80×8, 75×10" text (identical consecutive sets are grouped: 80×8 ×3)
function formatSets(sets) {
  const out = [];
  for (const s of sets) {
    const key = `${s.weight}×${s.reps}`;
    const last = out[out.length - 1];
    if (last && last.key === key && !!last.warm === !!s.is_warmup) last.n += 1;
    else out.push({ key, n: 1, warm: s.is_warmup });
  }
  return out.map(o => `${o.warm ? 'ı ' : ''}${o.key}${o.n > 1 ? ` ×${o.n}` : ''}`).join(', ').replace(/ı /g, '🔥');
}

async function exerciseStats(pool, exerciseId) {
  const sessions = (await exerciseHistory(pool, exerciseId, 200)).reverse();
  const points = sessions.map(s => ({ date: s.date, ...summarizeSets(s.sets) })).map(({ date, volume, maxWeight, e1rm }) => ({ date, volume, maxWeight, e1rm }));
  const prWeight = points.reduce((m, p) => (p.maxWeight > (m?.maxWeight || 0) ? p : m), null);
  const prE1rm = points.reduce((m, p) => (p.e1rm > (m?.e1rm || 0) ? p : m), null);
  return { points, prWeight, prE1rm };
}

// Suggestion for next time: if every working set of the last session reached the top rep count, add weight
function suggestNext(lastSets) {
  const work = (lastSets || []).filter(s => !s.is_warmup);
  if (work.length === 0) return null;
  const w = Math.max(...work.map(s => s.weight));
  const topSets = work.filter(s => s.weight === w);
  const minReps = Math.min(...topSets.map(s => s.reps));
  if (topSets.length >= 2 && minReps >= 8) return { weight: w + 2.5, reps: 8, reason: `Geçen sefer ${w} kg ile tüm setlerde ${minReps}+ tekrar yaptın` };
  return { weight: w, reps: minReps + 1, reason: `Aynı ağırlıkta bu sefer ${minReps + 1} tekrarı dene` };
}

// ---------- Nutrition ----------

const MEALS = ['kahvalti', 'ogle', 'aksam', 'ara'];
const MEAL_LABELS = { kahvalti: 'Kahvaltı', ogle: 'Öğle', aksam: 'Akşam', ara: 'Ara öğün' };

const scaleFood = (food, grams) => {
  const f = grams / 100;
  const r = (v) => Math.round(num(v) * f * 100) / 100;
  return { kcal: r(food.kcal), protein: r(food.protein), carbs: r(food.carbs), fat: r(food.fat), fiber: r(food.fiber), sugar: r(food.sugar), salt: r(food.salt) };
};

async function logMeal(pool, { date, meal, food, grams }) {
  const m = scaleFood(food, grams);
  const mealKey = MEALS.includes(meal) ? meal : 'ara';
  const { rows } = await pool.query(`
    INSERT INTO meal_logs (log_date, meal, food_id, food_name, grams, kcal, protein, carbs, fat, fiber, sugar, salt)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
  `, [isDate(date) ? date : today(), mealKey, food.id, food.name, grams, m.kcal, m.protein, m.carbs, m.fat, m.fiber, m.sugar, m.salt]);
  if (food.id) await pool.query('UPDATE foods SET use_count = use_count + 1 WHERE id = $1', [food.id]);
  return rows[0];
}

async function dayTotals(pool, date) {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(kcal),0) kcal, COALESCE(SUM(protein),0) protein, COALESCE(SUM(carbs),0) carbs,
           COALESCE(SUM(fat),0) fat, COALESCE(SUM(fiber),0) fiber, COALESCE(SUM(sugar),0) sugar, COALESCE(SUM(salt),0) salt
    FROM meal_logs WHERE log_date = $1
  `, [isDate(date) ? date : today()]);
  const o = {};
  for (const k of Object.keys(rows[0])) o[k] = round1(parseFloat(rows[0][k]));
  return o;
}

// Edit distance (small strings): lets "göğüs" find "göğsü"
const lev = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
};

// 0 = no match, 1 = typo-level match, 2 = exact word / substring match
const wordScore = (word, hayWords, hay) => {
  if (hay.includes(word)) return 2;
  if (word.length >= 4 && hayWords.some(h => h[0] === word[0] && lev(word, h) <= (word.length >= 5 ? 2 : 1))) return 1;
  if (word.length >= 4 && hayWords.some(h => h.startsWith(word.slice(0, 4)))) return 1;
  return 0;
};

async function searchFoods(pool, q, limit = 12) {
  const n = String(q || '').trim();
  if (!n) {
    return (await pool.query('SELECT * FROM foods ORDER BY use_count DESC, name LIMIT $1', [limit])).rows;
  }
  const words = norm(n).split(' ').filter(Boolean);
  const all = (await pool.query('SELECT * FROM foods')).rows;
  return all
    .map(f => {
      const hay = norm(`${f.name} ${f.brand}`);
      const hayWords = hay.split(' ');
      const scores = words.map(w => wordScore(w, hayWords, hay));
      if (scores.some(sc => sc === 0)) return null;
      const name = norm(f.name);
      const exact = scores.every(sc => sc === 2);
      const score = (name === norm(n) ? 100 : name.startsWith(words[0]) ? 60 : 30) + (exact ? 20 : 0) + Math.min(f.use_count, 30);
      return { f, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.f);
}

// Open Food Facts (free, no key). Returns normalized per-100g values.
async function searchOpenFoodFacts(q, limit = 8) {
  const headers = { 'User-Agent': 'SoftiumPlanner/1.0 (personal use)' };
  const normalize = (p) => {
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
    const name = (Array.isArray(p.product_name) ? p.product_name[0] : p.product_name_tr || p.product_name) || '';
    if (!String(name).trim() || kcal === null || kcal === undefined) return null;
    const brand = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0];
    return {
      name: String(name).trim(),
      brand: String(brand || '').trim(),
      barcode: p.code || '',
      kcal: round1(num(kcal)),
      protein: round1(num(n.proteins_100g)),
      carbs: round1(num(n.carbohydrates_100g)),
      fat: round1(num(n.fat_100g)),
      fiber: round1(num(n.fiber_100g)),
      sugar: round1(num(n.sugars_100g)),
      salt: round1(num(n.salt_100g)),
      serving_g: num(p.serving_quantity, 100) || 100,
      source: 'off'
    };
  };

  // 1) new, fast search service; 2) classic search as a fallback
  const attempts = [
    async () => {
      const res = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=${limit * 2}&langs=tr,en&fields=product_name,brands,code,nutriments,serving_quantity`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`search ${res.status}`);
      return (await res.json()).hits || [];
    },
    async () => {
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit * 2}&lc=tr&fields=product_name,product_name_tr,brands,code,serving_quantity,nutriments`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`cgi ${res.status}`);
      return (await res.json()).products || [];
    }
  ];
  let lastErr;
  for (const run of attempts) {
    try {
      return (await run()).map(normalize).filter(Boolean).slice(0, limit);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Open Food Facts yanıt vermedi.');
}

async function saveFood(pool, f, id = null) {
  const vals = [
    String(f.name || '').trim(), String(f.brand || '').trim(), String(f.barcode || '').trim(),
    num(f.kcal), num(f.protein), num(f.carbs), num(f.fat), num(f.fiber), num(f.sugar), num(f.salt),
    num(f.serving_g, 100) || 100, String(f.serving_label || 'porsiyon').trim() || 'porsiyon', f.source || 'custom'
  ];
  if (!vals[0]) throw new Error('Yemek adı gerekli.');
  if (id) {
    const { rows } = await pool.query(`
      UPDATE foods SET name=$1, brand=$2, barcode=$3, kcal=$4, protein=$5, carbs=$6, fat=$7, fiber=$8, sugar=$9, salt=$10, serving_g=$11, serving_label=$12, source=$13
      WHERE id=$14 RETURNING *`, [...vals, id]);
    return rows[0];
  }
  const { rows } = await pool.query(`
    INSERT INTO foods (name, brand, barcode, kcal, protein, carbs, fat, fiber, sugar, salt, serving_g, serving_label, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, vals);
  return rows[0];
}

async function getSetting(pool, key, fallback = null) {
  const { rows } = await pool.query('SELECT value FROM health_settings WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : fallback;
}

// Default daily targets from the profile (Mifflin-St Jeor); user overrides win
function computeTargets(profile) {
  if (!profile || !profile.weight || !profile.height || !profile.age) return null;
  const w = num(profile.weight), h = num(profile.height), a = num(profile.age);
  const bmr = 10 * w + 6.25 * h - 5 * a + (profile.sex === 'f' ? -161 : 5);
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[profile.activity] || 1.55;
  const tdee = bmr * factor;
  const delta = { lose: -400, maintain: 0, gain: 300 }[profile.goal] ?? 0;
  const kcal = Math.round(tdee + delta);
  const protein = Math.round(w * (profile.goal === 'lose' ? 2.2 : 1.8));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, tdee: Math.round(tdee) };
}

async function targets(pool) {
  const profile = await getSetting(pool, 'profile', null);
  const overrides = (await getSetting(pool, 'overrides', {})) || {};
  const auto = computeTargets(profile);
  const out = {};
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) {
    out[k] = overrides[k] ? num(overrides[k]) : auto ? auto[k] : 0;
  }
  return { ...out, auto, profile, overrides };
}

// ---------- REST API ----------

function register(app, pool) {
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('health:', err.message);
      res.status(err.status || 500).json({ error: err.message || 'Server error' });
    }
  };
  const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

  // Exercises
  app.get('/api/health/exercises', wrap(async (req, res) => res.json(await allExercises(pool))));
  app.post('/api/health/exercises', wrap(async (req, res) => {
    const ex = await findOrCreateExercise(pool, req.body.name, req.body.muscle);
    res.status(201).json(ex);
  }));
  app.put('/api/health/exercises/:id', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) throw bad('Hareket adı gerekli.');
    const aliases = (Array.isArray(req.body.aliases) ? req.body.aliases : String(req.body.aliases || '').split(','))
      .map(a => String(a).trim()).filter(Boolean);
    try {
      const { rows } = await pool.query('UPDATE exercises SET name = $1, muscle = $2, aliases = $3 WHERE id = $4 RETURNING *', [name, req.body.muscle || '', aliases, req.params.id]);
      if (!rows[0]) throw Object.assign(new Error('Hareket bulunamadı.'), { status: 404 });
      res.json(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw Object.assign(new Error('Bu isimde başka bir hareket var.'), { status: 409 });
      throw err;
    }
  }));
  app.delete('/api/health/exercises/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM exercises WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
  app.get('/api/health/exercises/recent', wrap(async (req, res) => {
    res.json(await recentSessionsAll(pool, Math.min(parseInt(req.query.limit) || 3, 10), isDate(req.query.before) ? req.query.before : null));
  }));
  app.get('/api/health/exercises/:id/history', wrap(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const history = await exerciseHistory(pool, req.params.id, limit, isDate(req.query.before) ? req.query.before : null);
    res.json({ history, suggestion: suggestNext(history[0]?.sets) });
  }));
  app.get('/api/health/exercises/:id/stats', wrap(async (req, res) => res.json(await exerciseStats(pool, req.params.id))));

  // Workouts
  app.get('/api/health/workouts', wrap(async (req, res) => {
    res.json(await loadWorkouts(pool, { from: isDate(req.query.from) ? req.query.from : null, to: isDate(req.query.to) ? req.query.to : null, limit: parseInt(req.query.limit) || 200 }));
  }));
  app.post('/api/health/workouts', wrap(async (req, res) => {
    const date = isDate(req.body.workout_date) ? req.body.workout_date : today();
    const { rows } = await pool.query('INSERT INTO workouts (workout_date, title, notes) VALUES ($1, $2, $3) RETURNING id', [date, req.body.title || '', req.body.notes || '']);
    res.status(201).json((await loadWorkouts(pool, { id: rows[0].id }))[0]);
  }));
  app.put('/api/health/workouts/:id', wrap(async (req, res) => {
    const cur = (await pool.query('SELECT * FROM workouts WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw Object.assign(new Error('Antrenman bulunamadı.'), { status: 404 });
    const date = isDate(req.body.workout_date) ? req.body.workout_date : null;
    await pool.query('UPDATE workouts SET title = $1, notes = $2, workout_date = COALESCE($3, workout_date) WHERE id = $4',
      [req.body.title ?? cur.title, req.body.notes ?? cur.notes, date, req.params.id]);
    res.json((await loadWorkouts(pool, { id: req.params.id }))[0]);
  }));
  app.delete('/api/health/workouts/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM workouts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
  // Copy a workout (structure, plus sets as a starting point) to another date
  app.post('/api/health/workouts/:id/copy', wrap(async (req, res) => {
    const src = (await loadWorkouts(pool, { id: req.params.id }))[0];
    if (!src) throw Object.assign(new Error('Antrenman bulunamadı.'), { status: 404 });
    const date = isDate(req.body.date) ? req.body.date : today();
    const { rows } = await pool.query('INSERT INTO workouts (workout_date, title, notes) VALUES ($1, $2, $3) RETURNING id', [date, src.title, '']);
    for (const ex of src.exercises) {
      const weId = await addExerciseToWorkout(pool, rows[0].id, ex.exercise_id);
      if (req.body.with_sets !== false) {
        for (const s of ex.sets) await addSet(pool, weId, s);
      }
    }
    res.status(201).json((await loadWorkouts(pool, { id: rows[0].id }))[0]);
  }));
  // Bring the exercises of an earlier workout (e.g. last "Push") into this one
  app.post('/api/health/workouts/:id/import', wrap(async (req, res) => {
    const src = (await loadWorkouts(pool, { id: req.body.from_id }))[0];
    if (!src) throw Object.assign(new Error('Kaynak antrenman bulunamadı.'), { status: 404 });
    for (const ex of src.exercises) {
      const weId = await addExerciseToWorkout(pool, req.params.id, ex.exercise_id);
      if (req.body.with_sets) for (const s of ex.sets) await addSet(pool, weId, s);
    }
    res.json((await loadWorkouts(pool, { id: req.params.id }))[0]);
  }));
  app.post('/api/health/workouts/:id/exercises', wrap(async (req, res) => {
    let exerciseId = req.body.exercise_id;
    if (!exerciseId) exerciseId = (await findOrCreateExercise(pool, req.body.name, req.body.muscle)).id;
    await addExerciseToWorkout(pool, req.params.id, exerciseId);
    res.status(201).json((await loadWorkouts(pool, { id: req.params.id }))[0]);
  }));
  app.delete('/api/health/workout-exercises/:id', wrap(async (req, res) => {
    const r = await pool.query('DELETE FROM workout_exercises WHERE id = $1 RETURNING workout_id', [req.params.id]);
    res.json(r.rows[0] ? (await loadWorkouts(pool, { id: r.rows[0].workout_id }))[0] : { ok: true });
  }));
  app.post('/api/health/workout-exercises/:id/sets', wrap(async (req, res) => {
    const reps = parseInt(req.body.reps);
    if (!(reps >= 0)) throw bad('Tekrar sayısı gerekli.');
    await addSet(pool, req.params.id, req.body);
    const we = (await pool.query('SELECT workout_id FROM workout_exercises WHERE id = $1', [req.params.id])).rows[0];
    res.status(201).json((await loadWorkouts(pool, { id: we.workout_id }))[0]);
  }));
  app.put('/api/health/sets/:id', wrap(async (req, res) => {
    const cur = (await pool.query('SELECT * FROM workout_sets WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw Object.assign(new Error('Set bulunamadı.'), { status: 404 });
    const b = req.body;
    await pool.query('UPDATE workout_sets SET weight=$1, reps=$2, rpe=$3, is_warmup=$4 WHERE id=$5', [
      b.weight !== undefined ? num(b.weight) : cur.weight,
      b.reps !== undefined ? Math.max(0, parseInt(b.reps) || 0) : cur.reps,
      b.rpe !== undefined ? (b.rpe === null || b.rpe === '' ? null : num(b.rpe)) : cur.rpe,
      b.is_warmup !== undefined ? !!b.is_warmup : cur.is_warmup,
      req.params.id
    ]);
    const we = (await pool.query('SELECT workout_id FROM workout_exercises WHERE id = $1', [cur.workout_exercise_id])).rows[0];
    res.json((await loadWorkouts(pool, { id: we.workout_id }))[0]);
  }));
  app.delete('/api/health/sets/:id', wrap(async (req, res) => {
    const r = await pool.query('DELETE FROM workout_sets WHERE id = $1 RETURNING workout_exercise_id', [req.params.id]);
    if (!r.rows[0]) return res.json({ ok: true });
    const we = (await pool.query('SELECT workout_id FROM workout_exercises WHERE id = $1', [r.rows[0].workout_exercise_id])).rows[0];
    res.json((await loadWorkouts(pool, { id: we.workout_id }))[0]);
  }));

  // Body weight
  app.get('/api/health/body-weights', wrap(async (req, res) => {
    const { rows } = await pool.query("SELECT id, to_char(log_date,'YYYY-MM-DD') AS log_date, weight FROM body_weights ORDER BY log_date DESC LIMIT 365");
    res.json(rows.map(r => ({ ...r, weight: parseFloat(r.weight) })));
  }));
  app.post('/api/health/body-weights', wrap(async (req, res) => {
    const w = num(req.body.weight);
    if (!(w > 0)) throw bad('Geçerli bir kilo girin.');
    await pool.query('INSERT INTO body_weights (log_date, weight) VALUES ($1, $2) ON CONFLICT (log_date) DO UPDATE SET weight = EXCLUDED.weight',
      [isDate(req.body.log_date) ? req.body.log_date : today(), w]);
    res.status(201).json({ ok: true });
  }));
  app.delete('/api/health/body-weights/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM body_weights WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // Foods
  app.get('/api/health/foods', wrap(async (req, res) => res.json(await searchFoods(pool, req.query.q, 30))));
  app.get('/api/health/foods/off', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    try {
      res.json(await searchOpenFoodFacts(q));
    } catch (err) {
      res.status(502).json({ error: 'Open Food Facts şu an erişilemiyor. Yemeği elle ekleyebilirsiniz.' });
    }
  }));
  app.post('/api/health/foods', wrap(async (req, res) => {
    // Re-use an already saved food with same barcode / name+brand
    const f = req.body;
    if (f.barcode) {
      const dup = (await pool.query('SELECT * FROM foods WHERE barcode = $1', [f.barcode])).rows[0];
      if (dup) return res.json(dup);
    }
    res.status(201).json(await saveFood(pool, f));
  }));
  app.put('/api/health/foods/:id', wrap(async (req, res) => res.json(await saveFood(pool, req.body, req.params.id))));
  app.delete('/api/health/foods/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM foods WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // Meals
  app.get('/api/health/meals', wrap(async (req, res) => {
    const date = isDate(req.query.date) ? req.query.date : today();
    const { rows } = await pool.query(`SELECT *, to_char(log_date,'YYYY-MM-DD') AS log_date FROM meal_logs WHERE log_date = $1 ORDER BY id`, [date]);
    const num2 = (v) => parseFloat(v);
    res.json({
      date,
      items: rows.map(r => ({ ...r, grams: num2(r.grams), kcal: num2(r.kcal), protein: num2(r.protein), carbs: num2(r.carbs), fat: num2(r.fat), fiber: num2(r.fiber), sugar: num2(r.sugar), salt: num2(r.salt) })),
      totals: await dayTotals(pool, date),
      targets: await targets(pool)
    });
  }));
  app.post('/api/health/meals', wrap(async (req, res) => {
    const grams = num(req.body.grams);
    if (!(grams > 0)) throw bad('Gramaj gerekli.');
    let food = null;
    if (req.body.food_id) food = (await pool.query('SELECT * FROM foods WHERE id = $1', [req.body.food_id])).rows[0];
    if (!food && req.body.food) food = await saveFood(pool, req.body.food);
    if (!food) throw bad('Yemek bulunamadı.');
    res.status(201).json(await logMeal(pool, { date: req.body.log_date, meal: req.body.meal, food, grams }));
  }));
  app.put('/api/health/meals/:id', wrap(async (req, res) => {
    const cur = (await pool.query('SELECT * FROM meal_logs WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw Object.assign(new Error('Kayıt bulunamadı.'), { status: 404 });
    const grams = req.body.grams !== undefined ? num(req.body.grams) : parseFloat(cur.grams);
    const meal = MEALS.includes(req.body.meal) ? req.body.meal : cur.meal;
    // Rescale the saved values proportionally to the new grams
    const f = grams / (parseFloat(cur.grams) || grams);
    const r = (v) => Math.round(parseFloat(v) * f * 100) / 100;
    await pool.query('UPDATE meal_logs SET grams=$1, meal=$2, kcal=$3, protein=$4, carbs=$5, fat=$6, fiber=$7, sugar=$8, salt=$9 WHERE id=$10',
      [grams, meal, r(cur.kcal), r(cur.protein), r(cur.carbs), r(cur.fat), r(cur.fiber), r(cur.sugar), r(cur.salt), req.params.id]);
    res.json({ ok: true });
  }));
  app.delete('/api/health/meals/:id', wrap(async (req, res) => {
    await pool.query('DELETE FROM meal_logs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // Settings / targets
  app.get('/api/health/settings', wrap(async (req, res) => res.json(await targets(pool))));
  app.put('/api/health/settings', wrap(async (req, res) => {
    if (req.body.profile) await pool.query("INSERT INTO health_settings (key, value) VALUES ('profile', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(req.body.profile)]);
    if (req.body.overrides) {
      const clean = {};
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) if (num(req.body.overrides[k]) > 0) clean[k] = num(req.body.overrides[k]);
      await pool.query("INSERT INTO health_settings (key, value) VALUES ('overrides', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(clean)]);
    }
    res.json(await targets(pool));
  }));

  // Weekly workout summary (volume / sessions per week) for the progress header
  app.get('/api/health/summary', wrap(async (req, res) => {
    const { rows } = await pool.query(`
      SELECT to_char(date_trunc('week', w.workout_date), 'YYYY-MM-DD') AS week,
             COUNT(DISTINCT w.id)::int AS sessions,
             COALESCE(SUM(CASE WHEN NOT s.is_warmup THEN s.weight * s.reps END), 0)::float AS volume,
             COUNT(s.id)::int AS sets
      FROM workouts w
      LEFT JOIN workout_exercises we ON we.workout_id = w.id
      LEFT JOIN workout_sets s ON s.workout_exercise_id = we.id
      WHERE w.workout_date >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `);
    res.json(rows);
  }));
}

module.exports = {
  migrate, register, norm, today, isDate, num, round1, epley, pad,
  allExercises, matchExercises, findOrCreateExercise,
  loadWorkouts, getOrCreateWorkout, addExerciseToWorkout, addSet,
  exerciseHistory, recentSessionsAll, summarizeSets, formatSets, exerciseStats, suggestNext,
  MEALS, MEAL_LABELS, scaleFood, logMeal, dayTotals, searchFoods, searchOpenFoodFacts, saveFood, targets, computeTargets
};
