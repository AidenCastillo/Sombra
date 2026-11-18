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

// Corporate landing page.
router.get("/", (req, res) => {
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
    });
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
