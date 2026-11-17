const express = require("express");

const router = express.Router();

// Public crawler instructions.
router.get("/robots.txt", (req, res) => {
    res.type("text/plain");

    res.send(
        `
User-agent: *
Disallow: /backup/

# Legacy migration archive retained during portal cutover
    `.trim(),
    );
});

// Backup directory.
router.get("/backup/", (req, res) => {
    res.render("backup-index");
});

// Archived IT report.
router.get("/backup/it-archive-2024.html", (req, res) => {
    const challenge = require("../challenges/registry").find(
        (c) => c.id === "forgotten-backup",
    );

    res.render("it-archive-2024", { challenge });
});

module.exports = router;
