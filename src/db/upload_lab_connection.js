const Database = require("better-sqlite3");

// Dedicated in-memory database for the document upload challenge.
// Never point this at the corporate portal or CTF database.
const db = new Database(":memory:");

db.exec(`
    CREATE TABLE upload_lab_secrets (
        id INTEGER PRIMARY KEY,
        secret TEXT NOT NULL
    );

    CREATE TABLE upload_lab_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL
    );

    INSERT INTO upload_lab_secrets (secret)
    VALUES ('SOMBRA{document_processor_compromised}');

    INSERT INTO upload_lab_results (message)
    VALUES ('Document processing service initialized.');
`);

module.exports = db;
