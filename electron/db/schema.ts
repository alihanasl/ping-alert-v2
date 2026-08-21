export const SCHEMA_VERSION = 1

export const INITIAL_SCHEMA = `
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE targets (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('icmp', 'tcp', 'http', 'snmp')),
  config TEXT NOT NULL DEFAULT '{}',
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  failure_threshold INTEGER NOT NULL DEFAULT 3,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
);

CREATE TABLE check_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'unknown')),
  response_time_ms INTEGER,
  message TEXT,
  checked_at TEXT NOT NULL,
  FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

CREATE TABLE app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_targets_group_id ON targets(group_id);
CREATE INDEX idx_targets_enabled ON targets(enabled);
CREATE INDEX idx_check_results_target_time ON check_results(target_id, checked_at);
CREATE INDEX idx_app_logs_created_at ON app_logs(created_at);
`
