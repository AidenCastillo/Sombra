const express = require("express");
const db = require("../db/connection");

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

module.exports = router;
