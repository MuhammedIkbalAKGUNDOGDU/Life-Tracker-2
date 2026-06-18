-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    notes TEXT DEFAULT '',
    client VARCHAR(255) DEFAULT '',
    type VARCHAR(50) DEFAULT 'personal', -- 'personal' or 'external'
    status VARCHAR(50) DEFAULT 'not_started', -- 'draft', 'not_started', 'in_progress', 'completed', 'on_hold'
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
    paid_price NUMERIC(12, 2) DEFAULT 0.00,
    description TEXT DEFAULT '',
    is_completed BOOLEAN DEFAULT FALSE,
    due_date DATE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    why_note TEXT DEFAULT '',
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT 'general', -- health, career, finance, education, social, general
    target_date DATE,
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    progress_type VARCHAR(50) DEFAULT 'boolean', -- 'boolean' or 'metric'
    current_value NUMERIC(12, 2) DEFAULT 0.00,
    target_value NUMERIC(12, 2) DEFAULT 1.00,
    unit VARCHAR(50) DEFAULT '', -- 'kitap', 'km', 'saat', 'adet' vb.
    is_completed BOOLEAN DEFAULT FALSE,
    link_url VARCHAR(512) DEFAULT '',
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
    weekly_targets INTEGER[] DEFAULT NULL,
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


-- Milestones (Başarımlar & Kilometre Taşları) Tablosu
CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    reward VARCHAR(255) DEFAULT '', -- Ödül / Motivasyon
    is_unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    target_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'projects_completed', 'goals_achieved', 'habit_streak'
    target_value INTEGER DEFAULT 1, -- Kilidin açılması için gereken miktar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Routines (Rutinler) Tablosu
CREATE TABLE IF NOT EXISTS routines (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    icon VARCHAR(50) DEFAULT 'sun', -- sun, moon, briefcase vb.
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Routine Steps (Rutin Adımları) Tablosu
CREATE TABLE IF NOT EXISTS routine_steps (
    id SERIAL PRIMARY KEY,
    routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Routine Completions (Rutin Günlük Tamamlanmaları) Tablosu
CREATE TABLE IF NOT EXISTS routine_completions (
    id SERIAL PRIMARY KEY,
    routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(routine_id, completed_date)
);

-- Journal Entries (Günlük & Duygu Takibi) Tablosu
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    entry_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5), -- 1-5 puan
    content TEXT DEFAULT '',
    tags VARCHAR(50)[] DEFAULT '{}', -- ['verimli', 'mutlu']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Routine Step Completions (Rutin Adım Tamamlanmaları) Tablosu
CREATE TABLE IF NOT EXISTS routine_step_completions (
    id SERIAL PRIMARY KEY,
    step_id INTEGER REFERENCES routine_steps(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(step_id, completed_date)
);

-- Routine Starts (Rutin Başlatılma Durumları) Tablosu
CREATE TABLE IF NOT EXISTS routine_starts (
    id SERIAL PRIMARY KEY,
    routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
    started_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(routine_id, started_date)
);-- Finance Assets (Varlık Portföyü) Tablosu
CREATE TABLE IF NOT EXISTS finance_assets (
    id SERIAL PRIMARY KEY,
    asset_type VARCHAR(50) NOT NULL, -- gold, stock, crypto, fund, cash
    ticker VARCHAR(50) NOT NULL,     -- GRAM, BTC, THYAO, MAC, USD vb.
    amount NUMERIC(16, 6) DEFAULT 0.000000,
    cost_price NUMERIC(20, 8) DEFAULT 0.00000000,
    asset_currency VARCHAR(10) DEFAULT 'TRY', -- TRY, USD, EUR
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Finance Transactions (Gelir & Gider Kayıtları) Tablosu
CREATE TABLE IF NOT EXISTS finance_transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,       -- income, expense
    category VARCHAR(100) NOT NULL,  -- salary, rent, food, transport, bills, installments, investment, general vb.
    amount NUMERIC(12, 2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description VARCHAR(255) DEFAULT '',
    installments_count INTEGER DEFAULT 1,
    installment_number INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
