-- Sales Reps table
CREATE TABLE IF NOT EXISTS reps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  start_date TEXT NOT NULL,
  territory TEXT,
  manager_id TEXT,
  manager_name TEXT,
  current_month INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Milestones table (defines what needs to be completed each month)
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  month INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'salesforce', 'certification', 'manager_approval'
  weight INTEGER DEFAULT 1,
  target_value REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Rep milestone progress
CREATE TABLE IF NOT EXISTS rep_milestones (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'missed'
  current_value REAL DEFAULT 0,
  target_value REAL,
  completed_at TEXT,
  notes TEXT,
  FOREIGN KEY (rep_id) REFERENCES reps(id),
  FOREIGN KEY (milestone_id) REFERENCES milestones(id),
  UNIQUE(rep_id, milestone_id)
);

-- Salesforce data (pipeline, deals, MEDDPICC)
CREATE TABLE IF NOT EXISTS salesforce_data (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  pipeline_value REAL DEFAULT 0,
  pipeline_coverage REAL DEFAULT 0,
  closed_deals INTEGER DEFAULT 0,
  total_deal_value REAL DEFAULT 0,
  meddpicc_completion_rate REAL DEFAULT 0,
  activity_score REAL DEFAULT 0,
  raw_data TEXT, -- JSON string for additional Salesforce fields
  synced_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (rep_id) REFERENCES reps(id)
);

-- Certifications/badges
CREATE TABLE IF NOT EXISTS certifications (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  name TEXT NOT NULL,
  badge_id TEXT,
  earned_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'earned', 'expired'
  FOREIGN KEY (rep_id) REFERENCES reps(id)
);

-- Manager checklists/approvals
CREATE TABLE IF NOT EXISTS manager_inputs (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  input_type TEXT NOT NULL, -- 'checklist', 'approval', 'note'
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  value TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (rep_id) REFERENCES reps(id)
);

-- Readiness scores (computed periodically)
CREATE TABLE IF NOT EXISTS readiness_scores (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  overall_score REAL NOT NULL,
  salesforce_score REAL,
  certification_score REAL,
  manager_score REAL,
  status TEXT NOT NULL, -- 'red', 'yellow', 'green'
  alerts TEXT, -- JSON array of alert messages
  recommended_actions TEXT, -- JSON array of actions
  computed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (rep_id) REFERENCES reps(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reps_manager ON reps(manager_id);
CREATE INDEX IF NOT EXISTS idx_rep_milestones_rep ON rep_milestones(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_milestones_status ON rep_milestones(status);
CREATE INDEX IF NOT EXISTS idx_salesforce_rep_month ON salesforce_data(rep_id, month);
CREATE INDEX IF NOT EXISTS idx_certifications_rep ON certifications(rep_id);
CREATE INDEX IF NOT EXISTS idx_manager_inputs_rep ON manager_inputs(rep_id);
CREATE INDEX IF NOT EXISTS idx_readiness_scores_rep ON readiness_scores(rep_id, month);
