const fs = require("node:fs");
// const path = require("node:path");

// const db = require("./connection");

// delete the database file if it exists
const dbPath = process.env.DB_PATH || "./data/sombra.sqlite";
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("Database file deleted.");
}
