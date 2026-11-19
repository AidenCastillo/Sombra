const express = require("express");
const db = require("../db/portal_connection");
const multer = require("multer");
const uploadLabDb = require("../db/upload_lab_connection");
const path = require("node:path");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 16 * 1024,
    },
});

const router = express.Router();

// function getGamemasterState() {
//     const rows = db
//         .prepare("SELECT key, value FROM portal_gamemaster_state")
//         .all();

//     const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));
//     return {
//         banner: state.portal.banner || "",
//         incidentMode: state.portal.incident_mode === "1",
//         watchMode: state.portal.watch_mode === "1",
//     };
// }

const PLAYER_USERNAME = "avery.patel";
const PLAYER_PASSWORD = "Sombra2026!";

function readPortalSession(req) {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("sombra_session="));

    if (!cookie) return null;

    const value = decodeURIComponent(cookie.slice("sombra_session=".length));
    const roleMatch = value.match(
        /(?:^|[;,&])role[:=](basic|admin)(?:[;,&]|$)/,
    );

    return {
        raw: value,
        role: roleMatch ? roleMatch[1] : "basic",
        authenticated: value.includes("user=avery.patel"),
    };
}

function requirePortalLogin(req, res, next) {
    const session = readPortalSession(req);

    if (!session || !session.authenticated) {
        return res.redirect("/login");
    }

    req.portalSession = session;
    next();
}

// Public Sombra Technologies website.
router.get("/", (req, res) => {
    res.render("public");
});

router.get("/login", (req, res) => {
    res.render("login", { error: req.query.error === "1" });
});

router.post("/login", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (username !== PLAYER_USERNAME || password !== PLAYER_PASSWORD) {
        return res.redirect("/login?error=1");
    }

    res.setHeader(
        "Set-Cookie",
        "sombra_session=user%3Davery.patel%26role%3Dbasic; Path=/; SameSite=Lax",
    );
    res.redirect("/employee");
});

router.post("/logout", (req, res) => {
    res.setHeader(
        "Set-Cookie",
        "sombra_session=; Path=/; SameSite=Lax; Max-Age=0",
    );
    res.redirect("/");
});

// Employee portal.
router.get("/employee", requirePortalLogin, (req, res) => {
    const departments = db
        .prepare(
            `
        SELECT name, description
        FROM departments
        ORDER BY name
    `,
        )
        .all();

    const employeeCount = db
        .prepare(
            `
        SELECT COUNT(*) AS count
        FROM users
        WHERE active = 1
    `,
        )
        .get().count;

    res.render("dashboard", {
        departments,
        employeeCount,
        role: req.portalSession.role,
    });
});

router.get("/employee/admin", requirePortalLogin, (req, res) => {
    if (req.portalSession.role !== "admin") {
        return res.status(403).render("restricted", {
            requiredRole: "admin",
            currentRole: req.portalSession.role,
        });
    }

    res.render("admin");
});

// Employee directory.
router.get("/directory", (req, res) => {
    const employees = db
        .prepare(
            `
        SELECT
            users.employee_no,
            users.first_name,
            users.last_name,
            users.title,
            users.email,
            departments.name AS department

        FROM users

        JOIN departments
        ON users.department_id = departments.id

        WHERE users.active = 1

        ORDER BY users.last_name
    `,
        )
        .all();

    res.json(employees);
});

router.get("/documents/upload", (req, res) => {
    res.render("document-upload");
});

router.get("/news", (req, res) => {
    res.render("news");
});

// Document library API.
router.get("/api/documents", (req, res) => {
    const documents = db
        .prepare(
            `
        SELECT id, title, category, summary
        FROM documents
        WHERE access_level = 'company'
        ORDER BY title
    `,
        )
        .all();

    res.json(documents);
});

// INSECURE DOCUMENT PROCESSING SERVICE
// Intentionally vulnerable CTF challenge.
router.post("/api/documents/upload", upload.single("document"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            error: "No document uploaded.",
        });
    }

    // Vulnerability: trusts the filename extension.
    const extension = path.extname(req.file.originalname).toLowerCase();

    if (extension !== ".pdf") {
        return res.status(400).json({
            error: "Only PDF documents are accepted.",
        });
    }

    try {
        // VULNERABILITY:
        // The server assumes the uploaded PDF is a document.
        // Instead, it directly executes its contents as SQL.
        const sql = req.file.buffer.toString("utf8");

        uploadLabDb.exec(sql);

        // Expose processing output for the challenge.
        const results = uploadLabDb
            .prepare(
                `
                    SELECT message
                    FROM upload_lab_results
                    ORDER BY id DESC
                    LIMIT 10
                `,
            )
            .all();

        return res.json({
            success: true,
            filename: req.file.originalname,
            message: "Document processed successfully.",
            results,
        });
    } catch (error) {
        // Intentionally leaks SQL errors for the CTF.
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

module.exports = router;
