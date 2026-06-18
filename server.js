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
    // Auto-migrate to add due_date column and verify yearly_payments, options, and items tables
    pool.query(`
      ALTER TABLE project_tasks 
      ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

      CREATE TABLE IF NOT EXISTS yearly_payments (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        client VARCHAR(255) DEFAULT '',
        amount NUMERIC(12, 2) DEFAULT 0.00,
        due_date DATE DEFAULT NULL,
        description TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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
    `, (migrateErr) => {
      if (migrateErr) {
        console.error('❌ Database migration error:', migrateErr.message);
      } else {
        console.log('✅ Database migration successful: yearly payments options, items, and structures verified.');
      }
    });
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
              'paid_price', t.paid_price,
              'description', t.description,
              'is_completed', t.is_completed,
              'due_date', t.due_date
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
              'paid_price', t.paid_price,
              'description', t.description,
              'is_completed', t.is_completed,
              'due_date', t.due_date
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
  const { title, weight, price, paid_price, description, due_date } = req.body;
  try {
    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const query = `
      INSERT INTO project_tasks (project_id, title, weight, price, paid_price, description, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      id, 
      title, 
      weight || 1, 
      price || 0.00, 
      paid_price || 0.00, 
      description || '',
      due_date || null
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error adding task' });
  }
});

// 6. UPDATE TASK STATUS (Toggle complete, change title/weight)
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, weight, price, paid_price, description, is_completed, due_date } = req.body;
  try {
    const getTask = await pool.query('SELECT * FROM project_tasks WHERE id = $1', [id]);
    if (getTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const currentTask = getTask.rows[0];
    const newTitle = title !== undefined ? title : currentTask.title;
    const newWeight = weight !== undefined ? weight : currentTask.weight;
    const newPrice = price !== undefined ? price : currentTask.price;
    const newPaidPrice = paid_price !== undefined ? paid_price : currentTask.paid_price;
    const newDescription = description !== undefined ? description : currentTask.description;
    const newIsCompleted = is_completed !== undefined ? is_completed : currentTask.is_completed;
    const newDueDate = due_date !== undefined ? due_date : currentTask.due_date;

    const query = `
      UPDATE project_tasks
      SET title = $1, weight = $2, price = $3, paid_price = $4, description = $5, is_completed = $6, due_date = $7
      WHERE id = $8
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      newTitle, 
      newWeight, 
      newPrice, 
      newPaidPrice, 
      newDescription, 
      newIsCompleted, 
      newDueDate,
      id
    ]);
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

      // 1. Calculate Current Streak
      const today = new Date();
      let checkDate = new Date(today);
      checkDate.setHours(0,0,0,0);
      
      let streakBroken = false;
      let consecutiveDays = 0;
      let daysChecked = 0;
      
      const todayStr = formatDate(checkDate);
      const isTodayRequired = isRequiredDay(todayStr);
      const isTodayCompleted = completedDates.has(todayStr);

      let startOffset = 0;
      if (isTodayRequired && !isTodayCompleted) {
        // Check if yesterday was completed or not required
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDate(yesterday);
        
        if (completedDates.has(yesterdayStr)) {
          startOffset = 1;
        } else if (!isRequiredDay(yesterdayStr)) {
          // If yesterday wasn't required, walk back to find the last required day
          let tempCheck = new Date(yesterday);
          let foundRequired = false;
          let tempChecked = 0;
          while (!foundRequired && tempChecked < 7) {
            tempCheck.setDate(tempCheck.getDate() - 1);
            const tempStr = formatDate(tempCheck);
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
        const dateStr = formatDate(checkDate);
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


// === MILESTONES (BAŞARIMLAR) API ENDPOINTS ===

// 1. GET ALL MILESTONES (with automatic unlocking evaluation)
app.get('/api/milestones', async (req, res) => {
  try {
    // Get actual system statistics
    const completedProjectsResult = await pool.query("SELECT COUNT(*) FROM projects WHERE status = 'completed'");
    const completedGoalsResult = await pool.query("SELECT COUNT(*) FROM goals WHERE is_completed = true");
    const maxStreakResult = await pool.query("SELECT COALESCE(MAX(streak_longest), 0) FROM habits");

    const pCount = parseInt(completedProjectsResult.rows[0].count);
    const gCount = parseInt(completedGoalsResult.rows[0].count);
    const streakCount = parseInt(maxStreakResult.rows[0].coalesce);

    // Auto-unlock achievements that meet their targets
    await pool.query(`
      UPDATE milestones 
      SET is_unlocked = true, unlocked_at = CURRENT_TIMESTAMP 
      WHERE is_unlocked = false AND (
        (target_type = 'projects_completed' AND target_value <= $1) OR
        (target_type = 'goals_achieved' AND target_value <= $2) OR
        (target_type = 'habit_streak' AND target_value <= $3)
      )
    `, [pCount, gCount, streakCount]);

    // Fetch all achievements
    const { rows: milestones } = await pool.query(
      'SELECT * FROM milestones ORDER BY is_unlocked DESC, unlocked_at DESC, created_at DESC'
    );

    res.json({
      milestones,
      stats: {
        completedProjects: pCount,
        completedGoals: gCount,
        maxHabitStreak: streakCount
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving milestones' });
  }
});

// 2. CREATE A NEW MILESTONE
app.post('/api/milestones', async (req, res) => {
  const { title, description, reward, target_type, target_value } = req.body;
  try {
    const query = `
      INSERT INTO milestones (title, description, reward, target_type, target_value)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [
      title,
      description || '',
      reward || '',
      target_type || 'manual',
      parseInt(target_value) || 1
    ];
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error creating milestone' });
  }
});

// 3. MANUALLY UNLOCK A MILESTONE
app.put('/api/milestones/:id/unlock', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      UPDATE milestones 
      SET is_unlocked = true, unlocked_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND is_unlocked = false 
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found or already unlocked' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error unlocking milestone' });
  }
});

// 4. DELETE A MILESTONE
app.delete('/api/milestones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM milestones WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    res.json({ message: 'Milestone deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting milestone' });
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


// === FINANCE (FİNANS PORTFÖYÜ & GELİR-GİDER) API ENDPOINTS ===

// Helper: Yahoo Finance price fetcher
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
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || currentPrice;
    return {
      price: currentPrice,
      currency: meta.currency,
      changePercent: ((currentPrice - prevClose) / prevClose) * 100
    };
  } catch (err) {
    console.error(`Error fetching Yahoo Finance price for ${symbol}:`, err.message);
    return null;
  }
};

// Helper: ALTIN.S1 Gold Certificate BIST price fetcher from Doviz.com
const fetchAltinS1Price = async () => {
  try {
    const url = 'https://borsa.doviz.com/hisseler';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    
    // Find the row for ALTINS1
    const idx = html.indexOf('id="ALTINS1"');
    if (idx === -1) return null;
    
    // Extract the section after id="ALTINS1"
    const sub = html.substring(idx, idx + 1000);
    // Find the first td value: e.g. <td class="text-bold">77,43</td>
    const match = sub.match(/<td[^>]*class="text-bold"[^>]*>\s*([0-9.,]+)\s*<\/td>/i);
    if (match) {
      const valStr = match[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(valStr);
      if (!isNaN(val)) {
        let changePercent = 0;
        const changeMatch = sub.match(/<td[^>]*class="[^"]*(?:color-up|color-down)[^"]*"[^>]*>\s*([^\s<]+)\s*<\/td>/i);
        if (changeMatch) {
          const changeStr = changeMatch[1].replace('%', '').replace(/\./g, '').replace(',', '.').trim();
          changePercent = parseFloat(changeStr) || 0;
        }
        return { price: val, changePercent };
      }
    }
    return null;
  } catch (e) {
    console.error('Error fetching ALTIN.S1 price from Doviz:', e.message);
    return null;
  }
};

// Helper: TEFAS Fund profiles fetcher
const fetchTefasPrices = async () => {
  const getTurkeyDate = (offsetDays = 0) => {
    const d = new Date(Date.now() + 3 * 60 * 60 * 1000 - offsetDays * 24 * 60 * 60 * 1000);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const fetchForKindAndDate = async (kind, dateStr) => {
    const url = 'https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir';
    const payload = {
      "fonTipi": kind,
      "fonKodu": null,
      "aramaMetni": null,
      "fonTurKod": null,
      "fonGrubu": null,
      "sfonTurKod": null,
      "fonTurAciklama": null,
      "kurucuKod": null,
      "basTarih": dateStr,
      "bitTarih": dateStr,
      "basSira": 1,
      "bitSira": 100000,
      "dil": "TR",
      "sFonTurKod": "",
      "fonKod": "",
      "fonGrup": "",
      "fonUnvanTip": ""
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Origin': 'https://www.tefas.gov.tr',
        'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data && data.resultList ? data.resultList : null;
  };

  try {
    let workingDate = null;
    let yatList = null;

    // Try to find a working date for YAT by going backwards up to 7 days
    for (let i = 0; i < 7; i++) {
      const dateStr = getTurkeyDate(i);
      const list = await fetchForKindAndDate('YAT', dateStr);
      if (list && list.length > 0) {
        workingDate = dateStr;
        yatList = list;
        break;
      }
      // Delay slightly between attempts to respect API rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    if (!workingDate || !yatList) {
      console.error('Failed to retrieve TEFAS YAT data for the last 7 days.');
      return {};
    }

    // Fetch EMK (Pension Funds) for the same working date
    let emkList = [];
    try {
      const list = await fetchForKindAndDate('EMK', workingDate);
      if (list && list.length > 0) {
        emkList = list;
      }
    } catch (e) {
      console.error(`Error fetching EMK funds:`, e.message);
    }

    // Process and merge both lists
    const fundPrices = {};
    const processList = (list) => {
      list.forEach(fund => {
        const code = fund.fonKodu;
        const price = parseFloat(fund.fiyat);
        if (code && !isNaN(price)) {
          fundPrices[code.toUpperCase()] = price;
        }
      });
    };

    processList(yatList);
    processList(emkList);

    return fundPrices;
  } catch (err) {
    console.error('Error fetching TEFAS prices:', err.message);
    return {};
  }
};

// 1. GET ALL CURRENT PRICES (Exchange, Gold, Crypto, BIST, Funds)
app.get('/api/finance/prices', async (req, res) => {
  try {
    // 1. Currencies & Gold (USDTRY, EURTRY, Gold Ons)
    const usdTryData = await fetchYahooPrice('USDTRY=X') || { price: 32.50, changePercent: 0 };
    const eurTryData = await fetchYahooPrice('EURTRY=X') || { price: 35.10, changePercent: 0 };
    const eurUsdData = await fetchYahooPrice('EURUSD=X') || { price: 1.08, changePercent: 0 };
    const goldOnsData = await fetchYahooPrice('GC=F') || { price: 2320, changePercent: 0 };

    const usdTry = usdTryData.price;
    const eurTry = eurTryData.price;

    // Calculate Gram Gold and Quarter Gold spot prices in TRY
    const gramGoldPrice = (goldOnsData.price / 31.1035) * usdTry;
    const gramGoldChange = goldOnsData.changePercent;
    
    const ceyrekGoldPrice = gramGoldPrice * 1.63;
    const ceyrekGoldChange = goldOnsData.changePercent;

    // 2. Cryptos (BTC, ETH, SOL)
    const btcData = await fetchYahooPrice('BTC-USD') || { price: 67000, changePercent: 0 };
    const ethData = await fetchYahooPrice('ETH-USD') || { price: 3500, changePercent: 0 };
    const solData = await fetchYahooPrice('SOL-USD') || { price: 150, changePercent: 0 };

    // Convert Cryptos to TRY
    const btcTry = btcData.price * usdTry;
    const ethTry = ethData.price * usdTry;
    const solTry = solData.price * usdTry;

    // 3. BIST 100 & Major BIST Stocks
    const bist100Data = await fetchYahooPrice('XU100.IS') || { price: 10100, changePercent: 0 };
    const thyaoData = await fetchYahooPrice('THYAO.IS') || { price: 310, changePercent: 0 };
    const aselsData = await fetchYahooPrice('ASELS.IS') || { price: 62, changePercent: 0 };
    const ereglData = await fetchYahooPrice('EREGL.IS') || { price: 50, changePercent: 0 };
    const kcholData = await fetchYahooPrice('KCHOL.IS') || { price: 220, changePercent: 0 };
    const bimasData = await fetchYahooPrice('BIMAS.IS') || { price: 410, changePercent: 0 };

    // 4. TEFAS Funds
    const tefasPrices = await fetchTefasPrices();

    const prices = {
      // Currencies
      USD: { TRY: usdTry, USD: 1, EUR: 1 / eurUsdData.price, changePercent: usdTryData.changePercent },
      EUR: { TRY: eurTry, USD: eurUsdData.price, EUR: 1, changePercent: eurTryData.changePercent },
      TRY: { TRY: 1, USD: 1 / usdTry, EUR: 1 / eurTry, changePercent: 0 },
      
      // Gold
      GRAM_GOLD: { TRY: gramGoldPrice, USD: gramGoldPrice / usdTry, EUR: gramGoldPrice / eurTry, changePercent: gramGoldChange },
      CEYREK_GOLD: { TRY: ceyrekGoldPrice, USD: ceyrekGoldPrice / usdTry, EUR: ceyrekGoldPrice / eurTry, changePercent: ceyrekGoldChange },
      ONS_GOLD: { TRY: goldOnsData.price * usdTry, USD: goldOnsData.price, EUR: goldOnsData.price / eurUsdData.price, changePercent: goldOnsData.changePercent },

      // Cryptos
      BTC: { TRY: btcTry, USD: btcData.price, EUR: btcData.price / eurUsdData.price, changePercent: btcData.changePercent },
      ETH: { TRY: ethTry, USD: ethData.price, EUR: ethData.price / eurUsdData.price, changePercent: ethData.changePercent },
      SOL: { TRY: solTry, USD: solData.price, EUR: solData.price / eurUsdData.price, changePercent: solData.changePercent },

      // BIST Stocks
      XU100: { TRY: bist100Data.price, USD: bist100Data.price / usdTry, EUR: bist100Data.price / eurTry, changePercent: bist100Data.changePercent },
      THYAO: { TRY: thyaoData.price, USD: thyaoData.price / usdTry, EUR: thyaoData.price / eurTry, changePercent: thyaoData.changePercent },
      ASELS: { TRY: aselsData.price, USD: aselsData.price / usdTry, EUR: aselsData.price / eurTry, changePercent: aselsData.changePercent },
      EREGL: { TRY: ereglData.price, USD: ereglData.price / usdTry, EUR: ereglData.price / eurTry, changePercent: ereglData.changePercent },
      KCHOL: { TRY: kcholData.price, USD: kcholData.price / usdTry, EUR: kcholData.price / eurTry, changePercent: kcholData.changePercent },
      BIMAS: { TRY: bimasData.price, USD: bimasData.price / usdTry, EUR: bimasData.price / eurTry, changePercent: bimasData.changePercent },

      // TEFAS Funds
      TEFAS: tefasPrices
    };

    // 5. Fetch custom BIST/Crypto tickers from database to get their live prices dynamically
    try {
      const { rows: userAssets } = await pool.query("SELECT DISTINCT ticker, asset_type FROM finance_assets");
      const predefinedTickers = new Set(['USD', 'EUR', 'TRY', 'GRAM_GOLD', 'CEYREK_GOLD', 'ONS_GOLD', 'BTC', 'ETH', 'SOL', 'XU100', 'THYAO', 'ASELS', 'EREGL', 'KCHOL', 'BIMAS']);
      
      for (const asset of userAssets) {
        const ticker = asset.ticker.toUpperCase();
        const type = asset.asset_type.toLowerCase();
        
        if (!predefinedTickers.has(ticker) && type !== 'cash' && type !== 'fund') {
          let tryVal, usdVal, eurVal, changePercent;
          let found = false;

          const normalizedTicker = ticker.replace('.IS', '').trim();
          if (normalizedTicker === 'ALTIN.S1' || normalizedTicker === 'ALTINS1' || normalizedTicker === 'ALTIN_S1') {
            // First, attempt to fetch the actual market price from Doviz.com
            const altinS1Market = await fetchAltinS1Price();
            if (altinS1Market && altinS1Market.price > 0) {
              tryVal = altinS1Market.price;
              changePercent = altinS1Market.changePercent;
              console.log(`Successfully fetched real BIST market price for ALTIN.S1: ${tryVal} TRY (Change: ${changePercent}%)`);
            } else {
              // Fallback to Gram Gold / 100 spot price if the scraper fails
              tryVal = gramGoldPrice / 100;
              changePercent = gramGoldChange;
              console.log(`Failed to fetch real market price for ALTIN.S1, falling back to spot gold price: ${tryVal} TRY`);
            }
            usdVal = tryVal / usdTry;
            eurVal = tryVal / eurTry;
            found = true;
          } else {
            let yahooData = null;
            if (type === 'stock') {
              if (ticker.endsWith('.IS')) {
                yahooData = await fetchYahooPrice(ticker);
              } else {
                // Try ticker directly first (e.g. AAPL, MSFT)
                yahooData = await fetchYahooPrice(ticker);
                if (!yahooData) {
                  // Fallback to BIST suffix (e.g. THYAO -> THYAO.IS)
                  yahooData = await fetchYahooPrice(`${ticker}.IS`);
                }
              }
            } else {
              let symbol = ticker;
              if (type === 'crypto') {
                symbol = ticker.endsWith('-USD') ? ticker : `${ticker}-USD`;
              } else if (type === 'gold' && ticker === 'ONS') {
                symbol = 'GC=F';
              }
              yahooData = await fetchYahooPrice(symbol);
            }

            if (yahooData) {
              changePercent = yahooData.changePercent;
              const yahooCurrency = (yahooData.currency || (type === 'crypto' ? 'USD' : 'TRY')).toUpperCase();
              
              if (yahooCurrency === 'TRY') {
                tryVal = yahooData.price;
                usdVal = tryVal / usdTry;
                eurVal = tryVal / eurTry;
              } else if (yahooCurrency === 'EUR') {
                eurVal = yahooData.price;
                tryVal = eurVal * eurTry;
                usdVal = tryVal / usdTry;
              } else { // Default to USD (US stocks, cryptos, etc.)
                usdVal = yahooData.price;
                tryVal = usdVal * usdTry;
                eurVal = usdVal / eurUsdData.price;
              }
              found = true;
            }
          }

          if (found) {
            prices[ticker] = {
              TRY: tryVal,
              USD: usdVal,
              EUR: eurVal,
              changePercent: changePercent
            };
          }
        }
      }
    } catch (err) {
      console.error('Error fetching custom asset prices dynamically:', err.message);
    }

    res.json(prices);
  } catch (err) {
    console.error('Error compiling finance prices:', err.message);
    res.status(500).json({ error: 'Server error retrieving current prices' });
  }
});

// 2. GET USER PORTFOLIO ASSETS
app.get('/api/finance/assets', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM finance_assets ORDER BY asset_type, ticker');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving assets' });
  }
});

// 3. ADD OR UPDATE PORTFOLIO ASSET
app.post('/api/finance/assets', async (req, res) => {
  const { asset_type, ticker, amount, cost_price, asset_currency } = req.body;
  try {
    const upperTicker = ticker.trim().toUpperCase();
    const type = asset_type.toLowerCase();
    const currency = (asset_currency || 'TRY').toUpperCase();
    
    // Check if asset already exists in portfolio with same type, ticker and currency
    const checkQuery = 'SELECT * FROM finance_assets WHERE asset_type = $1 AND ticker = $2 AND asset_currency = $3';
    const checkResult = await pool.query(checkQuery, [type, upperTicker, currency]);
    
    if (checkResult.rows.length > 0) {
      // Calculate weighted average cost price and add amounts
      const existing = checkResult.rows[0];
      const newAmount = parseFloat(existing.amount) + parseFloat(amount);
      const newCost = ((parseFloat(existing.amount) * parseFloat(existing.cost_price)) + (parseFloat(amount) * parseFloat(cost_price))) / newAmount;
      
      const updateQuery = 'UPDATE finance_assets SET amount = $1, cost_price = $2 WHERE id = $3 RETURNING *';
      const { rows } = await pool.query(updateQuery, [newAmount, newCost, existing.id]);
      res.json(rows[0]);
    } else {
      // Insert new asset
      const insertQuery = 'INSERT INTO finance_assets (asset_type, ticker, amount, cost_price, asset_currency) VALUES ($1, $2, $3, $4, $5) RETURNING *';
      const { rows } = await pool.query(insertQuery, [type, upperTicker, amount, cost_price, currency]);
      res.status(201).json(rows[0]);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error saving portfolio asset' });
  }
});

// 4. DELETE PORTFOLIO ASSET
app.delete('/api/finance/assets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM finance_assets WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting asset' });
  }
});

// 5. GET TRANSACTIONS (Gelir/Gider)
app.get('/api/finance/transactions', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM finance_transactions ORDER BY transaction_date DESC, created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error retrieving transactions' });
  }
});

// 6. ADD TRANSACTION (including future transactions and installments splitting)
app.post('/api/finance/transactions', async (req, res) => {
  const { type, category, amount, transaction_date, description, installments_count } = req.body;
  try {
    const count = parseInt(installments_count) || 1;
    const dateStr = transaction_date || new Date().toISOString().split('T')[0];
    const upperType = type.toLowerCase();
    
    if (count > 1 && upperType === 'expense') {
      // Installments: split into separate rows in DB for future months
      const insertedRows = [];
      const monthlyAmount = (parseFloat(amount) / count);
      
      for (let i = 0; i < count; i++) {
        // Calculate date of installment
        const d = new Date(dateStr);
        d.setMonth(d.getMonth() + i);
        const installmentDate = d.toISOString().split('T')[0];
        const installmentDesc = `${description || 'Taksitli Alışveriş'} (Taksit ${i + 1}/${count})`;
        
        const query = `
          INSERT INTO finance_transactions 
          (type, category, amount, transaction_date, description, installments_count, installment_number) 
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const { rows } = await pool.query(query, [
          'expense',
          category || 'installments',
          monthlyAmount,
          installmentDate,
          installmentDesc,
          count,
          i + 1
        ]);
        insertedRows.push(rows[0]);
      }
      res.status(201).json(insertedRows);
    } else {
      // Single transaction (can be future dated)
      const query = `
        INSERT INTO finance_transactions 
        (type, category, amount, transaction_date, description, installments_count, installment_number) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      `;
      const { rows } = await pool.query(query, [
        upperType,
        category || 'general',
        amount,
        dateStr,
        description || '',
        1,
        1
      ]);
      res.status(201).json(rows[0]);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error saving transaction' });
  }
});

// 7. DELETE A TRANSACTION
app.delete('/api/finance/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM finance_transactions WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error deleting transaction' });
  }
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
  const { project_id, title, client, due_date, description, items = [] } = req.body;
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const paymentQuery = `
      INSERT INTO yearly_payments (project_id, title, client, amount, due_date, description)
      VALUES ($1, $2, $3, 0.00, $4, $5)
      RETURNING *;
    `;
    const paymentRes = await dbClient.query(paymentQuery, [
      project_id || null,
      title,
      client || '',
      due_date || null,
      description || ''
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
  const { title, client, due_date, description, project_id, items = [] } = req.body;
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const updatePaymentQuery = `
      UPDATE yearly_payments
      SET title = $1, client = $2, due_date = $3, description = $4, project_id = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const updateRes = await dbClient.query(updatePaymentQuery, [
      title,
      client || '',
      due_date || null,
      description || '',
      project_id || null,
      id
    ]);
    if (updateRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Yearly payment not found' });
    }

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


// Serve the frontend app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
