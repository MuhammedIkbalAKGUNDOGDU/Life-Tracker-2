// Extra API routes: project templates and full-data backup download.
module.exports = function registerExtras(app, pool) {
  // --- Project templates (reusable task lists) ---
  app.get('/api/templates', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM project_templates ORDER BY name');
      res.json(rows);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error retrieving templates' });
    }
  });

  app.post('/api/templates', async (req, res) => {
    const { name, type, tasks } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Şablon adı gerekli.' });
    const cleanTasks = (Array.isArray(tasks) ? tasks : []).map(t => ({
      title: String(t.title || '').trim(),
      weight: Math.max(1, parseInt(t.weight) || 1),
      price: parseFloat(t.price) || 0,
      description: t.description || '',
      priority: Math.min(3, Math.max(1, parseInt(t.priority) || 2)),
      checklist: Array.isArray(t.checklist) ? t.checklist.map(i => ({ text: i.text, done: false })) : []
    })).filter(t => t.title);
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_templates (name, type, tasks) VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type, tasks = EXCLUDED.tasks
        RETURNING *;
      `, [String(name).trim(), type || 'personal', JSON.stringify(cleanTasks)]);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error saving template' });
    }
  });

  app.delete('/api/templates/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM project_templates WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error deleting template' });
    }
  });

  // --- Backup: every table as one JSON file ---
  app.get('/api/backup', async (req, res) => {
    try {
      const { rows: tables } = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      );
      const data = {};
      const SECRET_TABLES = new Set(['app_users', 'app_state']); // password hashes, session secret
      for (const { table_name } of tables.filter(t => !SECRET_TABLES.has(t.table_name))) {
        data[table_name] = (await pool.query(`SELECT * FROM "${table_name}"`)).rows;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="softium-planner-yedek-${stamp}.json"`);
      res.send(JSON.stringify({ exported_at: new Date().toISOString(), tables: data }, null, 2));
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error creating backup' });
    }
  });
};
