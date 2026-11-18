require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const portalDb = require("./db/portal_connection");
const ctfDb = require("./db/ctf_connection");

function applySchema(db, filename) {
    const schema = fs.readFileSync(
        path.join(__dirname, "db", filename),
        "utf8",
    );

    db.exec(schema);
}

applySchema(portalDb, "portal_schema.sql");
applySchema(ctfDb, "ctf_schema.sql");

const seed = require("./db/seed");
const seedCtf = require("./db/seed_ctf");
seed(portalDb);
seedCtf(ctfDb);

const app = require("./app");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
    console.log(`Sombra running at http://${HOST}:${PORT}`);
});

function shutdown() {
    server.close(() => {
        portalDb.close();
        ctfDb.close();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
