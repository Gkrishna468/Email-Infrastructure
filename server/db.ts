import Database from 'better-sqlite3';
import path from 'path';

// Using a persistent file if not in a serverless transient environment,
// but for the AI Studio preview environment, memory or a local file is fine.
// We'll use a file in the project root so it persists across dev server restarts.
const db = new Database('omnimail.sqlite', { verbose: console.log });

db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    subject TEXT,
    sender TEXT,
    body TEXT,
    summary TEXT,
    action_items TEXT, -- JSON array
    intent TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' -- pending, integrated, failed
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS interaction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT,
    action TEXT, -- e.g., 'mark_urgent', 'archive', 'mark_safe', 'mark_phishing'
    user_feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE emails ADD COLUMN metadata TEXT;');
} catch (e) {}

try {
  db.exec('ALTER TABLE emails ADD COLUMN outreach_draft TEXT;');
} catch (e) {}

try {
  db.exec('ALTER TABLE emails ADD COLUMN priority TEXT DEFAULT "To Read";');
} catch (e) {}

try {
  db.exec('ALTER TABLE emails ADD COLUMN security_status TEXT DEFAULT "Safe";');
} catch (e) {}

try {
  db.exec('ALTER TABLE emails ADD COLUMN security_reason TEXT;');
} catch (e) {}

export default db;
