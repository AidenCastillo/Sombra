
PRAGMA foreign_keys = ON;

-- Registered teams
CREATE TABLE IF NOT EXISTS ctf_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    team_name TEXT NOT NULL UNIQUE COLLATE NOCASE,

    password_hash TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    active INTEGER NOT NULL DEFAULT 1
);

-- Registered CTF participants
CREATE TABLE IF NOT EXISTS ctf_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    last_seen INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES ctf_teams(id)
);

-- CTF participant sessions. The browser receives only an opaque token.
CREATE TABLE IF NOT EXISTS ctf_sessions (
    token_hash TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES ctf_players(id) ON DELETE CASCADE
);

-- Challenges registered in the CTF platform
CREATE TABLE IF NOT EXISTS ctf_challenges (
    id TEXT PRIMARY KEY,

    title TEXT NOT NULL,

    category TEXT NOT NULL,

    difficulty TEXT NOT NULL,

    points INTEGER NOT NULL CHECK(points >= 0),

    flag_hash TEXT NOT NULL,

    active INTEGER NOT NULL DEFAULT 1
);

-- Every submitted flag
CREATE TABLE IF NOT EXISTS ctf_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    team_id INTEGER NOT NULL,

    challenge_id TEXT NOT NULL,

    is_correct INTEGER NOT NULL DEFAULT 0,

    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (team_id)
        REFERENCES ctf_teams(id),

    FOREIGN KEY (challenge_id)
        REFERENCES ctf_challenges(id)
);

-- Successful challenge completions
CREATE TABLE IF NOT EXISTS ctf_solves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    team_id INTEGER NOT NULL,

    challenge_id TEXT NOT NULL,

    points_awarded INTEGER NOT NULL,

    solved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (team_id)
        REFERENCES ctf_teams(id),

    FOREIGN KEY (challenge_id)
        REFERENCES ctf_challenges(id),

    UNIQUE(team_id, challenge_id)
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_ctf_attempts_team
ON ctf_attempts(team_id);

CREATE INDEX IF NOT EXISTS idx_ctf_attempts_challenge
ON ctf_attempts(challenge_id);

CREATE INDEX IF NOT EXISTS idx_ctf_solves_team
ON ctf_solves(team_id);

CREATE INDEX IF NOT EXISTS idx_ctf_solves_challenge
ON ctf_solves(challenge_id);

-- Game-master broadcast and event state
CREATE TABLE IF NOT EXISTS ctf_gamemaster_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
