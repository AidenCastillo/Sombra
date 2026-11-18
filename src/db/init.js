const fs = require("node:fs");
const path = require("node:path");

const portalDb = require("./portal_connection");
const ctfDb = require("./ctf_connection");

function initializeDatabase(db, schemaFile) {
    const schemaPath = path.join(__dirname, schemaFile);
    const schema = fs.readFileSync(schemaPath, "utf8");

    db.exec(schema);
}

try {
    console.log("Initializing Sombra databases...");

    // Corporate portal database
    initializeDatabase(portalDb, "portal_schema.sql");

    // CTF database
    initializeDatabase(ctfDb, "ctf_schema.sql");

    // Seed corporate data
    const seed = require("./seed");
    const seedCtf = require("./seed_ctf");
    seed(portalDb);
    seedCtf(ctfDb);

    console.log("Portal database initialized.");
    console.log("CTF database initialized.");
    console.log("Sombra initialization complete.");
} catch (error) {
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
} finally {
    portalDb.close();
    ctfDb.close();
}
