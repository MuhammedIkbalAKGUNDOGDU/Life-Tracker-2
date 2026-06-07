require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

// Test DB Connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL Database Connection Error:', err.message);
  } else {
    console.log('✅ PostgreSQL Database Connected Successfully at:', res.rows[0].now);
  }
});

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
              'is_completed', t.is_completed
            ) ORDER BY t.created_at
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
              'is_completed', t.is_completed
            ) ORDER BY t.created_at
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


// 5. ADD TASK TO A PROJECT
app.post('/api/projects/:id/tasks', async (req, res) => {
  const { id } = req.params;
  const { title, weight, price } = req.body;
  try {
    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const query = `
      INSERT INTO project_tasks (project_id, title, weight, price)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id, title, weight || 1, price || 0.00]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding task' });
  }
});

// 6. UPDATE TASK STATUS (Toggle complete, change title/weight)
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, weight, price, is_completed } = req.body;
  try {
    const getTask = await pool.query('SELECT * FROM project_tasks WHERE id = $1', [id]);
    if (getTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const currentTask = getTask.rows[0];
    const newTitle = title !== undefined ? title : currentTask.title;
    const newWeight = weight !== undefined ? weight : currentTask.weight;
    const newPrice = price !== undefined ? price : currentTask.price;
    const newIsCompleted = is_completed !== undefined ? is_completed : currentTask.is_completed;

    const query = `
      UPDATE project_tasks
      SET title = $1, weight = $2, price = $3, is_completed = $4
      WHERE id = $5
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [newTitle, newWeight, newPrice, newIsCompleted, id]);
    res.json(rows[0]);
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

// Serve the frontend app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
