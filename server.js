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
  const { title, why_note, category, target_date, priority, progress_type, current_value, target_value, unit, link_url } = req.body;
  try {
    const isCompleted = progress_type === 'metric' 
      ? (parseFloat(current_value) >= parseFloat(target_value)) 
      : false;
      
    const query = `
      INSERT INTO goals (title, why_note, category, target_date, priority, progress_type, current_value, target_value, unit, is_completed, link_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      title,
      why_note || '',
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
  const { title, why_note, category, target_date, priority, progress_type, current_value, target_value, unit, is_completed, link_url } = req.body;
  try {
    const getGoal = await pool.query('SELECT * FROM goals WHERE id = $1', [id]);
    if (getGoal.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const currentGoal = getGoal.rows[0];
    const newTitle = title !== undefined ? title : currentGoal.title;
    const newWhy = why_note !== undefined ? why_note : currentGoal.why_note;
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
      SET title = $1, why_note = $2, category = $3, target_date = $4, priority = $5, progress_type = $6, current_value = $7, target_value = $8, unit = $9, is_completed = $10, link_url = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [newTitle, newWhy, newCategory, newTargetDate, newPriority, newProgressType, newCurrentValue, newTargetValue, newUnit, isCompleted, newLink, id]);
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
    const getHabit = await pool.query('SELECT frequency, custom_days, target_count FROM habits WHERE id = $1', [habitId]);
    if (getHabit.rows.length === 0) return;
    const { frequency, custom_days, target_count } = getHabit.rows[0];

    // Get completed logs (where count >= target_count)
    const logsQuery = `
      SELECT log_date::text FROM habit_logs 
      WHERE habit_id = $1 AND count >= $2 
      ORDER BY log_date DESC;
    `;
    const { rows: logs } = await pool.query(logsQuery, [habitId, target_count]);
    const completedDates = new Set(logs.map(r => r.log_date));

    let currentStreak = 0;
    let longestStreak = 0;

    if (completedDates.size > 0) {
      const formatDate = (date) => date.toISOString().split('T')[0];

      // Helper to check if habit is required on a given day
      const isRequiredDay = (dateStr) => {
        if (frequency === 'daily') return true;
        if (frequency === 'custom') {
          const date = new Date(dateStr);
          let dayOfWeek = date.getDay(); 
          if (dayOfWeek === 0) dayOfWeek = 7; // Sunday maps to 7
          return (custom_days || []).includes(dayOfWeek);
        }
        return true;
      };

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
  const { title, description, category, frequency, custom_days, target_count } = req.body;
  try {
    const query = `
      INSERT INTO habits (title, description, category, frequency, custom_days, target_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      title,
      description || '',
      category || 'general',
      frequency || 'daily',
      custom_days || [],
      parseInt(target_count) || 1
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
  const { title, description, category, frequency, custom_days, target_count } = req.body;
  try {
    const query = `
      UPDATE habits
      SET title = $1, description = $2, category = $3, frequency = $4, custom_days = $5, target_count = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `;
    const values = [
      title,
      description || '',
      category || 'general',
      frequency || 'daily',
      custom_days || [],
      parseInt(target_count) || 1,
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

// Serve the frontend app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
