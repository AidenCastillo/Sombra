const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.DB_PATH = "./data/test.sqlite";

const fs = require("node:fs");

const dbPath = process.env.DB_PATH;

try {
    fs.unlinkSync(dbPath);
} catch {}

const Database = require("better-sqlite3");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

const portal_schema = fs.readFileSync("./src/db/portal_schema.sql", "utf8");
const ctf_schema = fs.readFileSync("./src/db/ctf_schema.sql", "utf8");

db.exec(portal_schema);
db.exec(ctf_schema);

require("../src/db/seed")(db);
require("../src/db/seed_ctf")(db);

db.close();

const app = require("../src/app");

test("Portal loads", async () => {
    const response = await request(app).get("/").expect(200);

    assert.match(response.text, /Sombra Technologies/);
});

test("Corp layout loads portal reverse assets", async () => {
    const response = await request(app).get("/").expect(200);

    assert.match(response.text, /\/css\/portal-reverse\.css/);
    assert.match(response.text, /\/js\/portal-reverse\.js/);
});

test("CTF page uses its own layout and does not load portal reverse assets", async () => {
    const response = await request(app).get("/ctf").expect(200);

    assert.doesNotMatch(response.text, /portal-reverse\.css/);
    assert.doesNotMatch(response.text, /portal-reverse\.js/);
});

test("Portal live state endpoint exposes gamemaster telemetry", async () => {
    const response = await request(app).get("/portal/live-state").expect(200);

    assert.equal(response.body.gamemaster.reverseEffect, "none");
    assert.equal(typeof response.body.gamemaster.banner, "string");
});

test("robots.txt exposes backup path", async () => {
    const response = await request(app).get("/robots.txt").expect(200);

    assert.match(response.text, /Disallow: \/backup\//);
});

test("Backup directory is accessible", async () => {
    const response = await request(app).get("/backup/").expect(200);

    assert.match(response.text, /Archive Directory/);
});

// test("Archived report contains the flag", async () => {
//     const response = await request(app)
//         .get("/backup/it-archive-2024.html")
//         .expect(200);

//     assert.match(response.text, /SOMBRA\{backup_discovered_7f3a91c2\}/);

//     assert.match(response.text, /svc_archive/);
//     assert.match(response.text, /ST-4930/);
// });

// test("Backup report contains the flag", async () => {
//     const response = await request(app)
//         .get("/backup/backup-report")
//         .expect(200);

//     assert.match(response.text, /SOMBRA\{backup_report_12345678\}/);
// });
