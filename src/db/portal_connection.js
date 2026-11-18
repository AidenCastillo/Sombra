const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config();

const dbPath = process.env.PORTAL_DB_PATH || "./data/portal.sqlite";

// Make sure the database directory exists.
fs.mkdirSync(path.dirname(dbPath), {
    recursive: true,
});

const db = new Database(dbPath);

// Enable database protections and reliability features.
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

module.exports = db;
