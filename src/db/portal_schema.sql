
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,

    title TEXT NOT NULL,
    department_id INTEGER NOT NULL,

    role TEXT NOT NULL DEFAULT 'employee'
        CHECK(role IN ('employee', 'it', 'admin')),

    office TEXT,
    phone_extension TEXT,
    notes TEXT,

    active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(department_id)
        REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT,
    body TEXT NOT NULL,

    access_level TEXT DEFAULT 'company',

    owner_id INTEGER,
    published_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,

    requester_id INTEGER NOT NULL,
    assigned_to INTEGER,

    subject TEXT NOT NULL,
    description TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),

    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK(priority IN ('low', 'normal', 'high', 'urgent')),

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(requester_id) REFERENCES users(id),
    FOREIGN KEY(assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    actor_user_id INTEGER,
    event_type TEXT NOT NULL,
    target TEXT NOT NULL,

    source_ip TEXT,
    details TEXT,

    occurred_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS incident_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    evidence_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL,

    discovered_by_challenge TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,

    FOREIGN KEY(user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_department
    ON users(department_id);

CREATE INDEX IF NOT EXISTS idx_tickets_requester
    ON support_tickets(requester_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_time
    ON audit_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
    ON sessions(expires_at);

