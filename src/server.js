require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const db = require("./db/connection");
const seed = require("./db/seed");

const app = require("./app");

// Automatically initialize the database.
const schema = fs.readFileSync(path.join(__dirname, "db/schema.sql"), "utf8");

db.exec(schema);
seed(db);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
    console.log(`
    =================================
       SOMBRA TECHNOLOGIES
       Employee Portal
    =================================

       Server: http://${HOST}:${PORT}
       Database: Connected
    `);
});

function shutdown() {
    console.log("Shutting down server...");

    server.close(() => {
        db.close();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
