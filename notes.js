// Notes to self: a simple list you can tick off. Used by the web app (REST API) and the Telegram bot.
// "Show completed" is one shared setting, so toggling it in the app or in the bot changes both.

async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      is_done BOOLEAN NOT NULL DEFAULT FALSE,
      done_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS note_date DATE;
    CREATE INDEX IF NOT EXISTS idx_notes_done ON notes(is_done);
  `);
}

const clean = (text) => String(text || '').replace(/\r/g, '').trim().slice(0, 2000);

async function listNotes(pool) {
  const { rows } = await pool.query('SELECT id, text, is_done, done_at, created_at, note_date FROM notes ORDER BY is_done, CASE WHEN is_done THEN done_at END DESC, created_at DESC, id DESC');
  return { active: rows.filter(n => !n.is_done), completed: rows.filter(n => n.is_done) };
}

const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);

async function addNote(pool, text, date) {
  const t = clean(text);
  if (!t) throw Object.assign(new Error('Not boş olamaz.'), { status: 400 });
  return (await pool.query('INSERT INTO notes (text, note_date) VALUES ($1, $2) RETURNING *', [t, cleanDate(date)])).rows[0];
}

async function setDate(pool, id, date) {
  return (await pool.query('UPDATE notes SET note_date = $1 WHERE id = $2 RETURNING *', [cleanDate(date), id])).rows[0] || null;
}

async function setDone(pool, id, done) {
  const { rows } = await pool.query(
    'UPDATE notes SET is_done = $1, done_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = $2 RETURNING *',
    [!!done, id]
  );
  return rows[0] || null;
}

async function updateText(pool, id, text) {
  const t = clean(text);
  if (!t) throw Object.assign(new Error('Not boş olamaz.'), { status: 400 });
  return (await pool.query('UPDATE notes SET text = $1 WHERE id = $2 RETURNING *', [t, id])).rows[0] || null;
}

async function deleteNote(pool, id) {
  const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [id]);
  return rowCount > 0;
}

async function clearCompleted(pool) {
  const { rowCount } = await pool.query('DELETE FROM notes WHERE is_done');
  return rowCount;
}

async function getShowCompleted(pool) {
  const { rows } = await pool.query("SELECT value FROM app_state WHERE key = 'notes_show_completed'");
  return rows[0] ? rows[0].value === 'true' : true; // shown by default
}

async function setShowCompleted(pool, show) {
  await pool.query(
    "INSERT INTO app_state (key, value) VALUES ('notes_show_completed', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [show ? 'true' : 'false']
  );
  return !!show;
}

function register(app, pool) {
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('notes:', err.message);
      res.status(err.status || 500).json({ error: err.message || 'Server error' });
    }
  };

  app.get('/api/notes', wrap(async (req, res) => {
    const { active, completed } = await listNotes(pool);
    res.json({ active, completed, showCompleted: await getShowCompleted(pool) });
  }));
  app.post('/api/notes', wrap(async (req, res) => res.status(201).json(await addNote(pool, req.body.text, req.body.note_date))));
  app.put('/api/notes/:id', wrap(async (req, res) => {
    let note = null;
    if (req.body.text !== undefined) note = await updateText(pool, req.params.id, req.body.text);
    if (req.body.note_date !== undefined) note = await setDate(pool, req.params.id, req.body.note_date);
    if (req.body.is_done !== undefined) note = await setDone(pool, req.params.id, req.body.is_done);
    if (!note) throw Object.assign(new Error('Not bulunamadı.'), { status: 404 });
    res.json(note);
  }));
  app.delete('/api/notes/completed', wrap(async (req, res) => res.json({ deleted: await clearCompleted(pool) })));
  app.delete('/api/notes/:id', wrap(async (req, res) => {
    if (!(await deleteNote(pool, req.params.id))) throw Object.assign(new Error('Not bulunamadı.'), { status: 404 });
    res.json({ ok: true });
  }));
  app.put('/api/notes-settings', wrap(async (req, res) => res.json({ showCompleted: await setShowCompleted(pool, !!req.body.showCompleted) })));
}

module.exports = { migrate, register, listNotes, addNote, setDone, updateText, deleteNote, clearCompleted, getShowCompleted, setShowCompleted };
