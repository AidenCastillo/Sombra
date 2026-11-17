const fs = require("node:fs");
const path = require("node:path");

const db = require("./connection");
const seed = require("./seed");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// Create all database tables.
db.exec(schema);

// Insert initial company data.
seed(db);

console.log("Database initialization complete.");

db.close();
