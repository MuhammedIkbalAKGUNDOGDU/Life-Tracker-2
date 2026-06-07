-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    notes TEXT DEFAULT '',
    client VARCHAR(255) DEFAULT '',
    type VARCHAR(50) DEFAULT 'personal', -- 'personal' or 'external'
    status VARCHAR(50) DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed', 'on_hold'
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Project tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    weight INTEGER DEFAULT 1 CHECK (weight >= 1),
    price NUMERIC(12, 2) DEFAULT 0.00,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    why_note TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT 'general', -- health, career, finance, education, social, general
    target_date DATE,
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    progress_type VARCHAR(50) DEFAULT 'boolean', -- 'boolean' or 'metric'
    current_value NUMERIC(12, 2) DEFAULT 0.00,
    target_value NUMERIC(12, 2) DEFAULT 1.00,
    unit VARCHAR(50) DEFAULT '', -- 'kitap', 'km', 'saat', 'adet' vb.
    is_completed BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Habits table
CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT 'general', -- health, career, finance, education, social, general
    frequency VARCHAR(50) DEFAULT 'daily', -- 'daily' or 'custom'
    custom_days INTEGER[] DEFAULT '{}', -- e.g. [1, 3, 5] (1=Pazartesi, 7=Pazar)
    target_count INTEGER DEFAULT 1 CHECK (target_count >= 1),
    streak_current INTEGER DEFAULT 0,
    streak_longest INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habit completion logs
CREATE TABLE IF NOT EXISTS habit_logs (
    id SERIAL PRIMARY KEY,
    habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    count INTEGER DEFAULT 1 CHECK (count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, log_date)
);

