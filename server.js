require('dotenv').config();
const express = require('express');
const { createAuth } = require('./auth');
const { Pool, types } = require('pg');
// Return DATE columns as plain 'YYYY-MM-DD' strings. As JS Dates they were serialized in UTC,
// which shifted every date one day back for servers/users ahead of UTC (e.g. Turkey).
types.setTypeParser(1082, (v) => v);
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
// Basic hardening headers (nginx can add HSTS on top)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Behind nginx: trust X-Forwarded-* so req.ip / req.secure are correct
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'life_tracker',
  user: process.env.DB_USER || 'ikbal',
  password: process.env.DB_PASSWORD || '',
});

// ---------- Startup: wait for the database, migrate, then everything else ----------
// Everything below runs strictly one after the other. (Running the migrations in parallel with the
// auth setup used to race on CREATE TABLE and could silently roll the whole migration back.)
const MIGRATION_SQL = `
      ALTER TABLE project_tasks 
      ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS is_today BOOLEAN DEFAULT FALSE;
      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2;
      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS repeat VARCHAR(20) DEFAULT '';
      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

      CREATE TABLE IF NOT EXISTS task_payments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES project_tasks(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL,
        paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
        note VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(50) DEFAULT 'personal',
        tasks JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS yearly_payments (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        client VARCHAR(255) DEFAULT '',
        amount NUMERIC(12, 2) DEFAULT 0.00,
        due_date DATE DEFAULT NULL,
        description TEXT DEFAULT '',
        is_paid BOOLEAN DEFAULT FALSE,
        payment_date DATE DEFAULT NULL,
        is_cancelled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE yearly_payments ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
      ALTER TABLE yearly_payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT NULL;
      ALTER TABLE yearly_payments ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS yearly_payment_options (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS yearly_payment_items (
        id SERIAL PRIMARY KEY,
        yearly_payment_id INTEGER REFERENCES yearly_payments(id) ON DELETE CASCADE,
        category VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'TRY',
        description VARCHAR(255) DEFAULT ''
      );

      ALTER TABLE yearly_payment_items 
      ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TRY';

      INSERT INTO yearly_payment_options (name)
      VALUES ('Sunucu / Hosting'), ('Alan Adı (Domain)'), ('Bakım ve Destek'), ('Yazılım Lisansı'), ('Diğer')
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO yearly_payment_items (yearly_payment_id, category, amount, description)
      SELECT id, 'Diğer', amount, 'Eski kayıttan aktarıldı'
      FROM yearly_payments
      WHERE amount > 0 AND id NOT IN (SELECT DISTINCT yearly_payment_id FROM yearly_payment_items)
      ON CONFLICT DO NOTHING;
    `;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitForDatabase() {
  for (let i = 1; i <= 40; i++) {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('✅ PostgreSQL Database Connected Successfully at:', res.rows[0].now);
      return;
    } catch (err) {
      console.log(`⏳ Waiting for the database (${i}/40): ${err.message}`);
      await sleep(2000);
    }
  }
  throw new Error('Database did not become available');
}

const health = require('./health');
const dbReady = (async () => {
  await waitForDatabase();
  await pool.query(MIGRATION_SQL);
  console.log('✅ Database migration successful: yearly payments options, items, and structures verified.');
  await health.migrate(pool);
  console.log('✅ Health tables ready');
})();
// If the database never comes up or a migration fails, exit so Docker restarts and retries
dbReady.catch(err => { console.error('❌ Startup failed:', err.message); process.exit(1); });

// Authentication: one account, created in the app on first visit (see auth.js).
// AUTH_DISABLED=true skips it entirely (local development only).
const authDisabled = process.env.AUTH_DISABLED === 'true';
if (authDisabled) console.warn('⚠️  AUTH_DISABLED=true: authentication is OFF (local development only).');
const authReady = dbReady.then(() => createAuth({ pool, disabled: authDisabled }));
authReady.catch(err => { console.error('❌ Auth init failed:', err.message); process.exit(1); });
const useAuth = (name) => async (req, res, next) => {
  try {
    return (await authReady)[name](req, res, next);
  } catch (err) {
    return next(err);
  }
};
app.get('/api/auth/status', useAuth('status'));
app.post('/api/auth/setup', useAuth('setup'));
app.post('/api/auth/login', useAuth('login'));
app.post('/api/auth/logout', useAuth('logout'));
app.post('/api/auth/change-password', useAuth('requireAuth'), useAuth('changePassword'));
app.use('/api', useAuth('requireAuth'));

// API Routes

// 1. GET ALL PROJECTS (with aggregated tasks and calculated progress)
app.get('/api/projects', async (req, res) => {
  try {
    const query = `
      SELECT p.*, 
        COALESCE(
          ROUND(
            (SUM(CASE WHEN t.is_completed THEN t.weight ELSE 0 END)::numeric / NULLIF(SUM(t.weight), 0)) * 100
          ), 
          0
        )::integer AS progress,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', t.id, 
              'title', t.title, 
              'weight', t.weight, 
              'price', t.price, 
              'paid_price', t.paid_price,
              'description', t.description,
              'is_completed', t.is_completed,
              'due_date', t.due_date,
              'sort_order', t.sort_order,
              'is_today', t.is_today,
              'priority', t.priority,
              'checklist', t.checklist,
              'repeat', t.repeat,
              'completed_at', t.completed_at,
              'payments', COALESCE((SELECT json_agg(json_build_object('id', tp.id, 'amount', tp.amount, 'paid_date', tp.paid_date, 'note', tp.note) ORDER BY tp.paid_date, tp.id) FROM task_payments tp WHERE tp.task_id = t.id), '[]'::json)
            ) ORDER BY t.sort_order, t.created_at
          ) FILTER (WHERE t.id IS NOT NULL), 
          '[]'
        ) AS tasks
      FROM projects p
      LEFT JOIN project_tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.sort_order ASC, p.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving projects' });
  }
});

// 2. CREATE A NEW PROJECT
app.post('/api/projects', async (req, res) => {
  const { title, description, notes, client: clientName, type, status } = req.body;
  try {
    const query = `
      INSERT INTO projects (title, description, notes, client, type, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      title, 
      description || '', 
      notes || '', 
      clientName || '',
      type || 'personal', 
      status || 'not_started'
    ];
    const { rows } = await pool.query(query, values);
    
    // Add default progress and empty tasks array to match GET structure
    const newProject = {
      ...rows[0],
      progress: 0,
      tasks: []
    };
    
    res.status(201).json(newProject);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating project' });
  }
});

// 2.5 REORDER PROJECTS
app.put('/api/projects/reorder', async (req, res) => {
  const { reorderedProjects } = req.body;
  if (!Array.isArray(reorderedProjects)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const proj of reorderedProjects) {
      await client.query('UPDATE projects SET sort_order = $1 WHERE id = $2', [proj.sort_order, proj.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Projects reordered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating order' });
  } finally {
    client.release();
  }
});

// 3. UPDATE PROJECT DETAILS
app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, notes, client: clientName, type, status } = req.body;
  try {
    const query = `
      UPDATE projects
      SET title = $1, description = $2, notes = $3, client = $4, type = $5, status = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [title, description, notes, clientName || '', type, status, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Fetch complete project view with progress and tasks
    const fullQuery = `
      SELECT p.*, 
        COALESCE(
          ROUND(
            (SUM(CASE WHEN t.is_completed THEN t.weight ELSE 0 END)::numeric / NULLIF(SUM(t.weight), 0)) * 100
          ), 
          0
        )::integer AS progress,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', t.id, 
              'title', t.title, 
              'weight', t.weight, 
              'price', t.price, 
              'paid_price', t.paid_price,
              'description', t.description,
              'is_completed', t.is_completed,
              'due_date', t.due_date,
              'sort_order', t.sort_order,
              'is_today', t.is_today,
              'priority', t.priority,
              'checklist', t.checklist,
              'repeat', t.repeat,
              'completed_at', t.completed_at,
              'payments', COALESCE((SELECT json_agg(json_build_object('id', tp.id, 'amount', tp.amount, 'paid_date', tp.paid_date, 'note', tp.note) ORDER BY tp.paid_date, tp.id) FROM task_payments tp WHERE tp.task_id = t.id), '[]'::json)
            ) ORDER BY t.sort_order, t.created_at
          ) FILTER (WHERE t.id IS NOT NULL), 
          '[]'
        ) AS tasks
      FROM projects p
      LEFT JOIN project_tasks t ON p.id = t.project_id
      WHERE p.id = $1
      GROUP BY p.id;
    `;
    const fullResult = await pool.query(fullQuery, [id]);
    res.json(fullResult.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating project' });
  }
});

// 4. DELETE A PROJECT
app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting project' });
  }
});


// Full task row incl. payment history (same shape as inside GET /api/projects)
const TASK_SELECT = `
  SELECT t.*,
    COALESCE((SELECT json_agg(json_build_object('id', tp.id, 'amount', tp.amount, 'paid_date', tp.paid_date, 'note', tp.note) ORDER BY tp.paid_date, tp.id)
              FROM task_payments tp WHERE tp.task_id = t.id), '[]'::json) AS payments
  FROM project_tasks t`;
const getTask = async (db, id) => (await db.query(`${TASK_SELECT} WHERE t.id = $1`, [id])).rows[0];

const clampPriority = (v) => Math.min(3, Math.max(1, parseInt(v) || 2));
const cleanChecklist = (list) =>
  Array.isArray(list)
    ? list.filter(i => i && String(i.text || '').trim()).map(i => ({ text: String(i.text).trim(), done: !!i.done }))
    : [];
const REPEATS = ['', 'daily', 'weekly', 'monthly'];

// Next due date for a recurring task (from its due date, or today when it has none)
const nextRepeatDate = (due, repeat) => {
  const d = due ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(due)) ? `${due}T00:00:00` : due) : new Date();
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 5. ADD TASK TO A PROJECT
app.post('/api/projects/:id/tasks', async (req, res) => {
  const { id } = req.params;
  const { title, weight, price, paid_price, description, due_date, priority, is_today, checklist, repeat } = req.body;
  try {
    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { rows } = await pool.query(`
      INSERT INTO project_tasks (project_id, title, weight, price, paid_price, description, due_date, priority, is_today, checklist, repeat, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        COALESCE((SELECT MAX(sort_order) + 1 FROM project_tasks WHERE project_id = $1), 0))
      RETURNING id;
    `, [
      id,
      title,
      weight || 1,
      price || 0.00,
      paid_price || 0.00,
      description || '',
      due_date || null,
      clampPriority(priority),
      !!is_today,
      JSON.stringify(cleanChecklist(checklist)),
      REPEATS.includes(repeat) ? repeat : ''
    ]);
    res.status(201).json(await getTask(pool, rows[0].id));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding task' });
  }
});

// 5.5 REORDER TASKS OF A PROJECT
app.put('/api/projects/:id/tasks/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Invalid data format' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await db.query('UPDATE project_tasks SET sort_order = $1 WHERE id = $2 AND project_id = $3', [i, ids[i], req.params.id]);
    }
    await db.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error reordering tasks' });
  } finally {
    db.release();
  }
});

// 6. UPDATE A TASK (any subset of fields). Completing a recurring task spawns the next one.
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const current = (await pool.query('SELECT * FROM project_tasks WHERE id = $1', [id])).rows[0];
    if (!current) return res.status(404).json({ error: 'Task not found' });

    const b = req.body;
    const pick = (key, fallback) => (b[key] !== undefined ? b[key] : fallback);
    const isCompleted = pick('is_completed', current.is_completed);
    const completedAt = isCompleted
      ? (current.is_completed ? current.completed_at : new Date())
      : null;

    await pool.query(`
      UPDATE project_tasks
      SET title = $1, weight = $2, price = $3, paid_price = $4, description = $5, is_completed = $6,
          due_date = $7, is_today = $8, priority = $9, checklist = $10, repeat = $11, completed_at = $12
      WHERE id = $13
    `, [
      pick('title', current.title),
      pick('weight', current.weight),
      pick('price', current.price),
      pick('paid_price', current.paid_price),
      pick('description', current.description),
      isCompleted,
      pick('due_date', current.due_date),
      b.is_today !== undefined ? !!b.is_today : current.is_today,
      b.priority !== undefined ? clampPriority(b.priority) : current.priority,
      JSON.stringify(b.checklist !== undefined ? cleanChecklist(b.checklist) : current.checklist),
      b.repeat !== undefined ? (REPEATS.includes(b.repeat) ? b.repeat : '') : current.repeat,
      completedAt,
      id
    ]);

    const task = await getTask(pool, id);

    // Recurring: when it flips to completed, create the next occurrence
    let spawned = null;
    if (isCompleted && !current.is_completed && task.repeat) {
      const ins = await pool.query(`
        INSERT INTO project_tasks (project_id, title, weight, price, paid_price, description, due_date, priority, is_today, checklist, repeat, sort_order)
        VALUES ($1, $2, $3, $4, 0, $5, $6, $7, FALSE, $8, $9,
          COALESCE((SELECT MAX(sort_order) + 1 FROM project_tasks WHERE project_id = $1), 0))
        RETURNING id;
      `, [
        task.project_id, task.title, task.weight, task.price, task.description,
        nextRepeatDate(task.due_date, task.repeat), task.priority,
        JSON.stringify((task.checklist || []).map(i => ({ ...i, done: false }))), task.repeat
      ]);
      spawned = await getTask(pool, ins.rows[0].id);
    }

    res.json({ ...task, spawned });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating task' });
  }
});

// 7. DELETE A TASK
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM project_tasks WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting task' });
  }
});

// 7.5 PAYMENT HISTORY: every collection is recorded with its date and adds to paid_price
app.post('/api/tasks/:id/payments', async (req, res) => {
  const { id } = req.params;
  const amount = parseFloat(req.body.amount);
  if (!amount) return res.status(400).json({ error: 'Tutar gerekli.' });
  try {
    const exists = await pool.query('SELECT id FROM project_tasks WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    await pool.query('INSERT INTO task_payments (task_id, amount, paid_date, note) VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4)',
      [id, amount, req.body.paid_date || null, req.body.note || '']);
    await pool.query('UPDATE project_tasks SET paid_price = paid_price + $1 WHERE id = $2', [amount, id]);
    res.status(201).json(await getTask(pool, id));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding payment' });
  }
});

app.delete('/api/task-payments/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM task_payments WHERE id = $1 RETURNING task_id, amount', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    await pool.query('UPDATE project_tasks SET paid_price = GREATEST(paid_price - $1, 0) WHERE id = $2', [rows[0].amount, rows[0].task_id]);
    res.json(await getTask(pool, rows[0].task_id));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting payment' });
  }
});

// === GOALS API ENDPOINTS ===

// 1. GET ALL GOALS
app.get('/api/goals', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM goals ORDER BY sort_order ASC, created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving goals' });
  }
});

// 2. CREATE A NEW GOAL
app.post('/api/goals', async (req, res) => {
  const { title, why_note, description, category, target_date, priority, progress_type, current_value, target_value, unit, link_url } = req.body;
  try {
    const isCompleted = progress_type === 'metric' 
      ? (parseFloat(current_value) >= parseFloat(target_value)) 
      : false;
      
    const query = `
      INSERT INTO goals (title, why_note, description, category, target_date, priority, progress_type, current_value, target_value, unit, is_completed, link_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const values = [
      title,
      why_note || '',
      description || '',
      category || 'general',
      target_date || null,
      parseInt(priority) || 3,
      progress_type || 'boolean',
      parseFloat(current_value) || 0.00,
      parseFloat(target_value) || 1.00,
      unit || '',
      isCompleted,
      link_url || ''
    ];
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating goal' });
  }
});

// 3. REORDER GOALS
app.put('/api/goals/reorder', async (req, res) => {
  const { reorderedGoals } = req.body;
  if (!Array.isArray(reorderedGoals)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const goal of reorderedGoals) {
      await client.query('UPDATE goals SET sort_order = $1 WHERE id = $2', [goal.sort_order, goal.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Goals reordered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating goal orders' });
  } finally {
    client.release();
  }
});

// 4. INCREMENT METRIC GOAL
app.put('/api/goals/:id/increment', async (req, res) => {
  const { id } = req.params;
  try {
    const getGoal = await pool.query('SELECT * FROM goals WHERE id = $1', [id]);
    if (getGoal.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const goal = getGoal.rows[0];
    if (goal.progress_type !== 'metric') {
      return res.status(400).json({ error: 'Goal is not metric-based' });
    }

    const newCurrentValue = parseFloat(goal.current_value) + 1;
    const isCompleted = newCurrentValue >= parseFloat(goal.target_value);

    const query = `
      UPDATE goals
      SET current_value = $1, is_completed = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [newCurrentValue, isCompleted, id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error incrementing goal' });
  }
});

// 5. UPDATE GOAL DETAILS
app.put('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  const { title, why_note, description, category, target_date, priority, progress_type, current_value, target_value, unit, is_completed, link_url } = req.body;
  try {
    const getGoal = await pool.query('SELECT * FROM goals WHERE id = $1', [id]);
    if (getGoal.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const currentGoal = getGoal.rows[0];
    const newTitle = title !== undefined ? title : currentGoal.title;
    const newWhy = why_note !== undefined ? why_note : currentGoal.why_note;
    const newDescription = description !== undefined ? description : currentGoal.description;
    const newCategory = category !== undefined ? category : currentGoal.category;
    const newTargetDate = target_date !== undefined ? target_date : currentGoal.target_date;
    const newPriority = priority !== undefined ? parseInt(priority) : currentGoal.priority;
    const newProgressType = progress_type !== undefined ? progress_type : currentGoal.progress_type;
    const newCurrentValue = current_value !== undefined ? parseFloat(current_value) : parseFloat(currentGoal.current_value);
    const newTargetValue = target_value !== undefined ? parseFloat(target_value) : parseFloat(currentGoal.target_value);
    const newUnit = unit !== undefined ? unit : currentGoal.unit;
    const newLink = link_url !== undefined ? link_url : currentGoal.link_url;
    
    const isCompleted = is_completed !== undefined 
      ? is_completed 
      : (newProgressType === 'metric' ? (newCurrentValue >= newTargetValue) : currentGoal.is_completed);

    const query = `
      UPDATE goals
      SET title = $1, why_note = $2, category = $3, target_date = $4, priority = $5, progress_type = $6, current_value = $7, target_value = $8, unit = $9, is_completed = $10, link_url = $11, description = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [newTitle, newWhy, newCategory, newTargetDate, newPriority, newProgressType, newCurrentValue, newTargetValue, newUnit, isCompleted, newLink, newDescription, id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating goal' });
  }
});

// 6. DELETE A GOAL
app.delete('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM goals WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ message: 'Goal deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting goal' });
  }
});


// === HABITS (ALIŞKANLIKLAR) API ENDPOINTS ===

// STREAK CALCULATOR HELPER
async function updateHabitStreaks(habitId) {
  try {
    // Get habit config
    const getHabit = await pool.query('SELECT frequency, custom_days, target_count, weekly_targets FROM habits WHERE id = $1', [habitId]);
    if (getHabit.rows.length === 0) return;
    const { frequency, custom_days, target_count, weekly_targets } = getHabit.rows[0];

    // Get all logs to evaluate completions dynamically
    const logsQuery = `
      SELECT log_date::text, count FROM habit_logs 
      WHERE habit_id = $1
      ORDER BY log_date DESC;
    `;
    const { rows: logs } = await pool.query(logsQuery, [habitId]);

    // Helper to check target count for a given date
    const getTargetForDate = (dateStr) => {
      if (weekly_targets && weekly_targets.length === 7) {
        const date = new Date(dateStr);
        let dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        if (dayOfWeek === 0) dayOfWeek = 7;
        return weekly_targets[dayOfWeek - 1] || 0;
      }
      return target_count || 1;
    };

    // Helper to check if habit is required on a given day
    const isRequiredDay = (dateStr) => {
      const date = new Date(dateStr);
      let dayOfWeek = date.getUTCDay(); 
      if (dayOfWeek === 0) dayOfWeek = 7;
      
      if (weekly_targets && weekly_targets.length === 7) {
        return (weekly_targets[dayOfWeek - 1] || 0) > 0;
      }
      if (frequency === 'daily') return true;
      if (frequency === 'custom') {
        return (custom_days || []).includes(dayOfWeek);
      }
      return true;
    };

    const completedDates = new Set();
    for (const log of logs) {
      const target = getTargetForDate(log.log_date);
      if (target > 0 && log.count >= target) {
        completedDates.add(log.log_date);
      }
    }

    let currentStreak = 0;
    let longestStreak = 0;

    if (completedDates.size > 0) {
      const formatDate = (date) => date.toISOString().split('T')[0];

      // 1. Calculate Current Streak (dates here come from the server's local clock, so format them locally, not as UTC)
      const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const today = new Date();
      let checkDate = new Date(today);
      checkDate.setHours(0,0,0,0);
      
      let streakBroken = false;
      let consecutiveDays = 0;
      let daysChecked = 0;
      
      const todayStr = fmtLocal(checkDate);
      const isTodayRequired = isRequiredDay(todayStr);
      const isTodayCompleted = completedDates.has(todayStr);

      let startOffset = 0;
      if (isTodayRequired && !isTodayCompleted) {
        // Check if yesterday was completed or not required
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = fmtLocal(yesterday);
        
        if (completedDates.has(yesterdayStr)) {
          startOffset = 1;
        } else if (!isRequiredDay(yesterdayStr)) {
          // If yesterday wasn't required, walk back to find the last required day
          let tempCheck = new Date(yesterday);
          let foundRequired = false;
          let tempChecked = 0;
          while (!foundRequired && tempChecked < 7) {
            tempCheck.setDate(tempCheck.getDate() - 1);
            const tempStr = fmtLocal(tempCheck);
            if (isRequiredDay(tempStr)) {
              foundRequired = true;
              if (completedDates.has(tempStr)) {
                startOffset = (today - tempCheck) / (1000 * 60 * 60 * 24);
              } else {
                streakBroken = true;
              }
            }
            tempChecked++;
          }
          if (!foundRequired) streakBroken = true;
        } else {
          streakBroken = true;
        }
      }

      checkDate.setDate(checkDate.getDate() - Math.floor(startOffset));

      while (!streakBroken && daysChecked < 365) {
        const dateStr = fmtLocal(checkDate);
        if (isRequiredDay(dateStr)) {
          if (completedDates.has(dateStr)) {
            consecutiveDays++;
          } else {
            streakBroken = true;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
        daysChecked++;
      }
      currentStreak = consecutiveDays;

      // 2. Calculate Longest Streak
      const sortedDates = Array.from(completedDates).sort();
      let maxStreak = 0;
      let tempStreak = 0;
      let lastDate = null;

      for (let i = 0; i < sortedDates.length; i++) {
        const dStr = sortedDates[i];
        if (lastDate === null) {
          tempStreak = 1;
        } else {
          const prevDate = new Date(lastDate);
          const currDate = new Date(dStr);
          
          let temp = new Date(prevDate);
          temp.setDate(temp.getDate() + 1);
          let missedRequiredDay = false;
          while (temp < currDate) {
            const tempStr = formatDate(temp);
            if (isRequiredDay(tempStr)) {
              missedRequiredDay = true;
              break;
            }
            temp.setDate(temp.getDate() + 1);
          }

          if (!missedRequiredDay) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        }
        maxStreak = Math.max(maxStreak, tempStreak);
        lastDate = dStr;
      }
      longestStreak = maxStreak;
    }

    // Save Calculated Streaks
    await pool.query(
      'UPDATE habits SET streak_current = $1, streak_longest = $2 WHERE id = $3',
      [currentStreak, longestStreak, habitId]
    );
  } catch (err) {
    console.error('Error updating streaks for habit:', habitId, err.message);
  }
}

// 1. GET ALL HABITS (with nested logs)
app.get('/api/habits', async (req, res) => {
  try {
    const query = `
      SELECT h.*, 
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', l.id, 'log_date', l.log_date::text, 'count', l.count) ORDER BY l.log_date DESC
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) AS logs
      FROM habits h
      LEFT JOIN habit_logs l ON h.id = l.habit_id AND l.log_date >= CURRENT_DATE - INTERVAL '35 days'
      GROUP BY h.id
      ORDER BY h.sort_order ASC, h.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving habits' });
  }
});

// 2. CREATE A NEW HABIT
app.post('/api/habits', async (req, res) => {
  const { title, description, category, frequency, custom_days, target_count, weekly_targets } = req.body;
  try {
    const query = `
      INSERT INTO habits (title, description, category, frequency, custom_days, target_count, weekly_targets)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      title,
      description || '',
      category || 'general',
      frequency || 'daily',
      custom_days || [],
      parseInt(target_count) || 1,
      weekly_targets || null
    ];
    const { rows } = await pool.query(query, values);
    
    const newHabit = {
      ...rows[0],
      logs: []
    };
    res.status(201).json(newHabit);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating habit' });
  }
});

// 3. REORDER HABITS
app.put('/api/habits/reorder', async (req, res) => {
  const { reorderedHabits } = req.body;
  if (!Array.isArray(reorderedHabits)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const habit of reorderedHabits) {
      await client.query('UPDATE habits SET sort_order = $1 WHERE id = $2', [habit.sort_order, habit.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Habits reordered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating habit orders' });
  } finally {
    client.release();
  }
});

// 4. LOG/TOGGLE HABIT FOR A SPECIFIC DATE
app.post('/api/habits/:id/log', async (req, res) => {
  const { id } = req.params;
  const { log_date, count } = req.body;
  try {
    if (parseInt(count) <= 0) {
      await pool.query('DELETE FROM habit_logs WHERE habit_id = $1 AND log_date = $2', [id, log_date]);
    } else {
      const query = `
        INSERT INTO habit_logs (habit_id, log_date, count)
        VALUES ($1, $2, $3)
        ON CONFLICT (habit_id, log_date)
        DO UPDATE SET count = $3
        RETURNING *;
      `;
      await pool.query(query, [id, log_date, count]);
    }
    
    // Recalculate Streaks
    await updateHabitStreaks(id);
    
    // Return complete habit details
    const fullQuery = `
      SELECT h.*, 
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', l.id, 'log_date', l.log_date::text, 'count', l.count) ORDER BY l.log_date DESC
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) AS logs
      FROM habits h
      LEFT JOIN habit_logs l ON h.id = l.habit_id AND l.log_date >= CURRENT_DATE - INTERVAL '35 days'
      WHERE h.id = $1
      GROUP BY h.id;
    `;
    const { rows } = await pool.query(fullQuery, [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error logging habit' });
  }
});

// 5. UPDATE HABIT DETAILS
app.put('/api/habits/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, category, frequency, custom_days, target_count, weekly_targets } = req.body;
  try {
    const query = `
      UPDATE habits
      SET title = $1, description = $2, category = $3, frequency = $4, custom_days = $5, target_count = $6, weekly_targets = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *;
    `;
    const values = [
      title,
      description || '',
      category || 'general',
      frequency || 'daily',
      custom_days || [],
      parseInt(target_count) || 1,
      weekly_targets || null,
      id
    ];
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Habit not found' });
    }
    
    // Recalculate streaks in case target count or frequency changed
    await updateHabitStreaks(id);
    
    // Return complete habit details
    const fullQuery = `
      SELECT h.*, 
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', l.id, 'log_date', l.log_date::text, 'count', l.count) ORDER BY l.log_date DESC
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) AS logs
      FROM habits h
      LEFT JOIN habit_logs l ON h.id = l.habit_id AND l.log_date >= CURRENT_DATE - INTERVAL '35 days'
      WHERE h.id = $1
      GROUP BY h.id;
    `;
    const { rows: result } = await pool.query(fullQuery, [id]);
    res.json(result[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating habit' });
  }
});

// 6. DELETE A HABIT
app.delete('/api/habits/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM habits WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Habit not found' });
    }
    res.json({ message: 'Habit deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting habit' });
  }
});


// === ROUTINES (RUTİNLER) API ENDPOINTS ===

// 1. GET ALL ROUTINES
app.get('/api/routines', async (req, res) => {
  try {
    const { rows: routines } = await pool.query('SELECT * FROM routines ORDER BY sort_order ASC, created_at DESC');
    const { rows: steps } = await pool.query('SELECT * FROM routine_steps ORDER BY routine_id, sort_order ASC');
    const { rows: completions } = await pool.query("SELECT routine_id FROM routine_completions WHERE completed_date = CURRENT_DATE");
    const { rows: starts } = await pool.query("SELECT routine_id FROM routine_starts WHERE started_date = CURRENT_DATE");
    const { rows: stepCompletions } = await pool.query("SELECT step_id FROM routine_step_completions WHERE completed_date = CURRENT_DATE");

    const completionSet = new Set(completions.map(c => c.routine_id));
    const startSet = new Set(starts.map(s => s.routine_id));
    const stepCompletionSet = new Set(stepCompletions.map(sc => sc.step_id));

    const routinesWithSteps = routines.map(r => {
      const routineSteps = steps.filter(s => s.routine_id === r.id).map(step => ({
        ...step,
        is_completed_today: stepCompletionSet.has(step.id)
      }));

      return {
        ...r,
        steps: routineSteps,
        is_completed_today: completionSet.has(r.id),
        is_started_today: startSet.has(r.id)
      };
    });

    res.json(routinesWithSteps);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving routines' });
  }
});

// 2. CREATE A NEW ROUTINE
app.post('/api/routines', async (req, res) => {
  const { title, description, icon, steps } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: routineRows } = await client.query(
      'INSERT INTO routines (title, description, icon) VALUES ($1, $2, $3) RETURNING *',
      [title, description || '', icon || 'sun']
    );
    const routine = routineRows[0];
    const insertedSteps = [];
    if (Array.isArray(steps) && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const stepTitle = typeof steps[i] === 'string' ? steps[i] : steps[i].title;
        if (stepTitle && stepTitle.trim()) {
          const { rows: stepRows } = await client.query(
            'INSERT INTO routine_steps (routine_id, title, sort_order) VALUES ($1, $2, $3) RETURNING *',
            [routine.id, stepTitle.trim(), i]
          );
          insertedSteps.push(stepRows[0]);
        }
      }
    }
    await client.query('COMMIT');
    res.status(201).json({
      ...routine,
      steps: insertedSteps.map(s => ({ ...s, is_completed_today: false })),
      is_completed_today: false,
      is_started_today: false
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating routine' });
  } finally {
    client.release();
  }
});

// 2.5 UPDATE A ROUTINE (title, description, icon; steps are matched by id so today's checkmarks survive)
app.put('/api/routines/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, icon, steps } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Rutin adı gerekli.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query('UPDATE routines SET title = $1, description = $2, icon = $3 WHERE id = $4 RETURNING id',
      [String(title).trim(), description || '', icon || 'sun', id]);
    if (upd.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Routine not found' });
    }
    const keep = [];
    const list = Array.isArray(steps) ? steps : [];
    for (let i = 0; i < list.length; i++) {
      const stepTitle = (typeof list[i] === 'string' ? list[i] : list[i].title || '').trim();
      if (!stepTitle) continue;
      const stepId = typeof list[i] === 'object' ? list[i].id : null;
      const own = stepId ? await client.query('SELECT id FROM routine_steps WHERE id = $1 AND routine_id = $2', [stepId, id]) : { rows: [] };
      if (own.rows.length) {
        await client.query('UPDATE routine_steps SET title = $1, sort_order = $2 WHERE id = $3', [stepTitle, i, stepId]);
        keep.push(stepId);
      } else {
        const ins = await client.query('INSERT INTO routine_steps (routine_id, title, sort_order) VALUES ($1, $2, $3) RETURNING id', [id, stepTitle, i]);
        keep.push(ins.rows[0].id);
      }
    }
    await client.query('DELETE FROM routine_steps WHERE routine_id = $1 AND NOT (id = ANY($2::int[]))', [id, keep]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating routine' });
  } finally {
    client.release();
  }
});

// 3. TOGGLE/COMPLETE ROUTINE FOR TODAY
app.post('/api/routines/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { is_completed } = req.body;
  try {
    if (is_completed) {
      // Mark as started and completed today
      await pool.query(
        "INSERT INTO routine_starts (routine_id, started_date) VALUES ($1, CURRENT_DATE) ON CONFLICT (routine_id, started_date) DO NOTHING",
        [id]
      );
      await pool.query(
        "INSERT INTO routine_completions (routine_id, completed_date) VALUES ($1, CURRENT_DATE) ON CONFLICT (routine_id, completed_date) DO NOTHING",
        [id]
      );
      
      // Auto-complete all steps for today
      const { rows: steps } = await pool.query("SELECT id FROM routine_steps WHERE routine_id = $1", [id]);
      for (const step of steps) {
        await pool.query(
          "INSERT INTO routine_step_completions (step_id, completed_date) VALUES ($1, CURRENT_DATE) ON CONFLICT (step_id, completed_date) DO NOTHING",
          [step.id]
        );
      }
    } else {
      await pool.query(
        "DELETE FROM routine_completions WHERE routine_id = $1 AND completed_date = CURRENT_DATE",
        [id]
      );
    }
    res.json({ message: 'Routine status updated successfully', is_completed_today: is_completed });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating routine status' });
  }
});

// 3.5 START/RESET ROUTINE FOR TODAY
app.post('/api/routines/:id/start', async (req, res) => {
  const { id } = req.params;
  const { is_started } = req.body;
  try {
    if (is_started) {
      await pool.query(
        "INSERT INTO routine_starts (routine_id, started_date) VALUES ($1, CURRENT_DATE) ON CONFLICT (routine_id, started_date) DO NOTHING",
        [id]
      );
    } else {
      // Remove starts, completions and step completions
      await pool.query(
        "DELETE FROM routine_starts WHERE routine_id = $1 AND started_date = CURRENT_DATE",
        [id]
      );
      await pool.query(
        "DELETE FROM routine_completions WHERE routine_id = $1 AND completed_date = CURRENT_DATE",
        [id]
      );
      
      const { rows: steps } = await pool.query("SELECT id FROM routine_steps WHERE routine_id = $1", [id]);
      const stepIds = steps.map(s => s.id);
      if (stepIds.length > 0) {
        await pool.query(
          "DELETE FROM routine_step_completions WHERE step_id = ANY($1) AND completed_date = CURRENT_DATE",
          [stepIds]
        );
      }
    }
    res.json({ message: 'Routine start status updated', is_started_today: is_started });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating routine start status' });
  }
});

// 3.8 TOGGLE STEP COMPLETION FOR TODAY
app.post('/api/routines/steps/:stepId/complete', async (req, res) => {
  const { stepId } = req.params;
  const { is_completed } = req.body;
  try {
    if (is_completed) {
      await pool.query(
        "INSERT INTO routine_step_completions (step_id, completed_date) VALUES ($1, CURRENT_DATE) ON CONFLICT (step_id, completed_date) DO NOTHING",
        [stepId]
      );
    } else {
      await pool.query(
        "DELETE FROM routine_step_completions WHERE step_id = $1 AND completed_date = CURRENT_DATE",
        [stepId]
      );
    }
    res.json({ message: 'Step completion status updated', is_completed_today: is_completed });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating step status' });
  }
});

// 4. DELETE A ROUTINE
app.delete('/api/routines/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM routines WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Routine not found' });
    }
    res.json({ message: 'Routine deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting routine' });
  }
});


// === JOURNAL & MOOD (GÜNLÜK & DUYGU TAKİBİ) API ENDPOINTS ===

// 1. GET ALL JOURNAL ENTRIES
app.get('/api/journal', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM journal_entries ORDER BY entry_date DESC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving journal entries' });
  }
});

// 2. CREATE/UPDATE A JOURNAL ENTRY (ON CONFLICT DO UPDATE)
app.post('/api/journal', async (req, res) => {
  const { entry_date, mood_rating, content, tags } = req.body;
  try {
    const query = `
      INSERT INTO journal_entries (entry_date, mood_rating, content, tags)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (entry_date)
      DO UPDATE SET mood_rating = $2, content = $3, tags = $4
      RETURNING *;
    `;
    const values = [
      entry_date || new Date().toISOString().split('T')[0],
      mood_rating !== undefined ? parseInt(mood_rating) : null,
      content || '',
      tags || []
    ];
    const { rows } = await pool.query(query, values);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error saving journal entry' });
  }
});

// 3. DELETE A JOURNAL ENTRY
app.delete('/api/journal/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM journal_entries WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    res.json({ message: 'Journal entry deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting journal entry' });
  }
});


// === EXCHANGE RATE (USD/TRY) ===

const fetchYahooPrice = async (symbol) => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch (err) {
    console.error(`Error fetching Yahoo Finance price for ${symbol}:`, err.message);
    return null;
  }
};

// Cached for 30 minutes; falls back to the last known (or a default) rate on failure
let rateCache = { usdTry: 34.0, fetchedAt: 0 };
app.get('/api/rates', async (req, res) => {
  if (Date.now() - rateCache.fetchedAt > 30 * 60 * 1000) {
    const price = await fetchYahooPrice('USDTRY=X');
    if (price) rateCache = { usdTry: price, fetchedAt: Date.now() };
    else rateCache.fetchedAt = Date.now() - 25 * 60 * 1000; // retry in ~5 minutes
  }
  res.json({ USD: { TRY: rateCache.usdTry } });
});

// === YEARLY PAYMENTS API ENDPOINTS ===

// 1. GET ALL YEARLY PAYMENTS (with nested items)
app.get('/api/yearly-payments', async (req, res) => {
  try {
    const query = `
      SELECT y.*, p.title as project_title, p.client as project_client,
             COALESCE(
               (SELECT json_agg(json_build_object(
                  'id', yi.id,
                  'category', yi.category,
                  'amount', yi.amount,
                  'currency', yi.currency,
                  'description', yi.description
                ) ORDER BY yi.id)
                FROM yearly_payment_items yi
                WHERE yi.yearly_payment_id = y.id),
               '[]'::json
             ) as items
      FROM yearly_payments y
      LEFT JOIN projects p ON y.project_id = p.id
      ORDER BY y.due_date ASC, y.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving yearly payments' });
  }
});

// 2. CREATE A YEARLY PAYMENT (with items)
app.post('/api/yearly-payments', async (req, res) => {
  const { project_id, title, client, due_date, description, is_paid, payment_date, is_cancelled, items = [] } = req.body;
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const paymentQuery = `
      INSERT INTO yearly_payments (project_id, title, client, amount, due_date, description, is_paid, payment_date, is_cancelled)
      VALUES ($1, $2, $3, 0.00, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const paymentRes = await dbClient.query(paymentQuery, [
      project_id || null,
      title,
      client || '',
      due_date || null,
      description || '',
      is_paid || false,
      payment_date || null,
      is_cancelled || false
    ]);
    const newPayment = paymentRes.rows[0];

    // Insert items
    if (items && items.length > 0) {
      for (const item of items) {
        const itemQuery = `
          INSERT INTO yearly_payment_items (yearly_payment_id, category, amount, currency, description)
          VALUES ($1, $2, $3, $4, $5);
        `;
        await dbClient.query(itemQuery, [
          newPayment.id,
          item.category,
          item.amount || 0.00,
          item.currency || 'TRY',
          item.description || ''
        ]);
      }
    }
    
    // Auto-generate next year's payment if created as paid, and NOT cancelled (undo of a delete skips this)
    if (is_paid && !is_cancelled && !req.body.skip_next) {
      let nextDueDate = null;
      let nextTitle = title;
      if (due_date) {
        const d = new Date(due_date);
        if (!isNaN(d.getTime())) {
          d.setFullYear(d.getFullYear() + 1);
          nextDueDate = d.toISOString().split('T')[0];
          
          // Try to increment year in title if a 4-digit year exists (e.g., "Hosting 2026" -> "Hosting 2027")
          const yearRegex = /\b(20\d{2})\b/;
          const match = title.match(yearRegex);
          if (match) {
            const oldYear = parseInt(match[1]);
            const newYear = oldYear + 1;
            nextTitle = title.replace(yearRegex, String(newYear));
          }
        }
      }

      const nextPaymentQuery = `
        INSERT INTO yearly_payments (project_id, title, client, amount, due_date, description, is_paid, payment_date, is_cancelled)
        VALUES ($1, $2, $3, 0.00, $4, $5, FALSE, NULL, FALSE)
        RETURNING id;
      `;
      const nextPaymentRes = await dbClient.query(nextPaymentQuery, [
        project_id || null,
        nextTitle,
        client || '',
        nextDueDate,
        description || ''
      ]);
      const nextPaymentId = nextPaymentRes.rows[0].id;

      if (items && items.length > 0) {
        for (const item of items) {
          const nextItemQuery = `
            INSERT INTO yearly_payment_items (yearly_payment_id, category, amount, currency, description)
            VALUES ($1, $2, $3, $4, $5);
          `;
          await dbClient.query(nextItemQuery, [
            nextPaymentId,
            item.category,
            item.amount || 0.00,
            item.currency || 'TRY',
            item.description || ''
          ]);
        }
      }
    }
    
    await dbClient.query('COMMIT');
    
    // Fetch and return the complete payment with aggregated items
    const completeQuery = `
      SELECT y.*, p.title as project_title, p.client as project_client,
             COALESCE(
               (SELECT json_agg(json_build_object(
                  'id', yi.id,
                  'category', yi.category,
                  'amount', yi.amount,
                  'currency', yi.currency,
                  'description', yi.description
                ) ORDER BY yi.id)
                FROM yearly_payment_items yi
                WHERE yi.yearly_payment_id = y.id),
               '[]'::json
             ) as items
      FROM yearly_payments y
      LEFT JOIN projects p ON y.project_id = p.id
      WHERE y.id = $1;
    `;
    const finalRes = await pool.query(completeQuery, [newPayment.id]);
    res.status(201).json(finalRes.rows[0]);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating yearly payment' });
  } finally {
    dbClient.release();
  }
});

// 3. UPDATE A YEARLY PAYMENT (with items)
app.put('/api/yearly-payments/:id', async (req, res) => {
  const { id } = req.params;
  const { title, client, due_date, description, project_id, is_paid, payment_date, is_cancelled, items = [] } = req.body;
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    
    // Fetch old payment status to see if it was paid
    const oldPaymentRes = await dbClient.query('SELECT is_paid FROM yearly_payments WHERE id = $1', [id]);
    if (oldPaymentRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Yearly payment not found' });
    }
    const oldPayment = oldPaymentRes.rows[0];

    const updatePaymentQuery = `
      UPDATE yearly_payments
      SET title = $1, client = $2, due_date = $3, description = $4, project_id = $5, is_paid = $6, payment_date = $7, is_cancelled = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *;
    `;
    const updateRes = await dbClient.query(updatePaymentQuery, [
      title,
      client || '',
      due_date || null,
      description || '',
      project_id || null,
      is_paid || false,
      payment_date || null,
      is_cancelled || false,
      id
    ]);

    // Delete existing items
    await dbClient.query('DELETE FROM yearly_payment_items WHERE yearly_payment_id = $1', [id]);

    // Insert new items
    if (items && items.length > 0) {
      for (const item of items) {
        const itemQuery = `
          INSERT INTO yearly_payment_items (yearly_payment_id, category, amount, currency, description)
          VALUES ($1, $2, $3, $4, $5);
        `;
        await dbClient.query(itemQuery, [
          id,
          item.category,
          item.amount || 0.00,
          item.currency || 'TRY',
          item.description || ''
        ]);
      }
    }

    // Auto-generate next year's payment if transitioned from unpaid to paid, and NOT cancelled
    if (!oldPayment.is_paid && is_paid && !is_cancelled) {
      let nextDueDate = null;
      let nextTitle = title;
      if (due_date) {
        const d = new Date(due_date);
        if (!isNaN(d.getTime())) {
          d.setFullYear(d.getFullYear() + 1);
          nextDueDate = d.toISOString().split('T')[0];
          
          // Try to increment year in title if a 4-digit year exists (e.g., "Hosting 2026" -> "Hosting 2027")
          const yearRegex = /\b(20\d{2})\b/;
          const match = title.match(yearRegex);
          if (match) {
            const oldYear = parseInt(match[1]);
            const newYear = oldYear + 1;
            nextTitle = title.replace(yearRegex, String(newYear));
          }
        }
      }

      const nextPaymentQuery = `
        INSERT INTO yearly_payments (project_id, title, client, amount, due_date, description, is_paid, payment_date, is_cancelled)
        VALUES ($1, $2, $3, 0.00, $4, $5, FALSE, NULL, FALSE)
        RETURNING id;
      `;
      const nextPaymentRes = await dbClient.query(nextPaymentQuery, [
        project_id || null,
        nextTitle,
        client || '',
        nextDueDate,
        description || ''
      ]);
      const nextPaymentId = nextPaymentRes.rows[0].id;

      if (items && items.length > 0) {
        for (const item of items) {
          const nextItemQuery = `
            INSERT INTO yearly_payment_items (yearly_payment_id, category, amount, currency, description)
            VALUES ($1, $2, $3, $4, $5);
          `;
          await dbClient.query(nextItemQuery, [
            nextPaymentId,
            item.category,
            item.amount || 0.00,
            item.currency || 'TRY',
            item.description || ''
          ]);
        }
      }
    }

    await dbClient.query('COMMIT');

    // Fetch and return the complete payment with aggregated items
    const completeQuery = `
      SELECT y.*, p.title as project_title, p.client as project_client,
             COALESCE(
               (SELECT json_agg(json_build_object(
                  'id', yi.id,
                  'category', yi.category,
                  'amount', yi.amount,
                  'currency', yi.currency,
                  'description', yi.description
                ) ORDER BY yi.id)
                FROM yearly_payment_items yi
                WHERE yi.yearly_payment_id = y.id),
               '[]'::json
             ) as items
      FROM yearly_payments y
      LEFT JOIN projects p ON y.project_id = p.id
      WHERE y.id = $1;
    `;
    const finalRes = await pool.query(completeQuery, [id]);
    res.json(finalRes.rows[0]);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating yearly payment' });
  } finally {
    dbClient.release();
  }
});

// 4. DELETE A YEARLY PAYMENT
app.delete('/api/yearly-payments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM yearly_payments WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Yearly payment not found' });
    }
    res.json({ message: 'Yearly payment deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting yearly payment' });
  }
});

// 5. GET ALL YEARLY PAYMENT OPTIONS
app.get('/api/yearly-payment-options', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM yearly_payment_options ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving yearly payment options' });
  }
});

// 6. CREATE A YEARLY PAYMENT OPTION
app.post('/api/yearly-payment-options', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Option name is required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO yearly_payment_options (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name.trim()]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Option already exists' });
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating yearly payment option' });
  }
});

// 7. DELETE A YEARLY PAYMENT OPTION
app.delete('/api/yearly-payment-options/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM yearly_payment_options WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Option not found' });
    }
    res.json({ message: 'Option deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting yearly payment option' });
  }
});


require('./extras')(app, pool);

// Health: workouts + nutrition
health.register(app, pool);

// Send a test reminder right now (needs TELEGRAM_* env vars)
app.post('/api/reminders/test', async (req, res) => {
  const reminders = require('./reminders');
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID tanımlı değil.' });
  }
  try {
    const text = (await reminders.buildMessage(pool)) || 'Bugün için bekleyen ödeme yok. ✅';
    await reminders.send(text);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Unknown API routes answer with JSON (never the HTML page)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the frontend app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});


// Start Server
require('./reminders').start(pool);
require('./telegram').start(pool);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
