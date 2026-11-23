const express = require("express");
const router = express.Router();
const { requirePortalLogin } = require("../../middleware/portal-auth");
const db = require("../../db/portal_connection");
const path = require("path");
const upload = require("multer")();

router.get(
    ["/documents", "/employee/documents", "/api/documents"],
    requirePortalLogin,
    (req, res) => {
        const requestedId = Number(req.query.id);
        if (
            req.path !== "/api/documents" &&
            Number.isInteger(requestedId) &&
            requestedId > 0
        ) {
            const document = db
                .prepare(
                    `
                SELECT documents.*, users.username AS owner_username
                FROM documents LEFT JOIN users ON users.id = documents.owner_id
                WHERE documents.id = ? AND documents.access_level = 'company'
            `,
                )
                .get(requestedId);
            if (!document) return res.status(404).send("Document not found.");
            return res.render("document-viewer", {
                document,
                role: req.portalSession.role,
            });
        }

        const documents = db
            .prepare(
                `
        SELECT id, title, category, summary, access_level, published_at
        FROM documents
        WHERE access_level = 'company'
        ORDER BY title
    `,
            )
            .all();
        if (
            req.path === "/api/documents" ||
            req.accepts(["html", "json"]) === "json"
        )
            return res.json(documents);
        res.render("document-library", {
            documents,
            role: req.portalSession.role,
        });
    },
);

router.get("/documents/upload", requirePortalLogin, (req, res) =>
    res.render("document-upload"),
);

router.get("/documents/:id", requirePortalLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(404).send("Document not found.");
    }

    const document = db
        .prepare(
            `
        SELECT documents.*, users.username AS owner_username
        FROM documents LEFT JOIN users ON users.id = documents.owner_id
        WHERE documents.id = ? AND documents.access_level = 'company'
    `,
        )
        .get(id);
    if (!document) return res.status(404).send("Document not found.");
    res.render("document-viewer", {
        document,
        role: req.portalSession.role,
    });
});

router.post(
    "/api/documents/upload",
    requirePortalLogin,
    upload.single("document"),
    (req, res) => {
        if (!req.file)
            return res.status(400).json({ error: "No document uploaded." });
        const extension = path.extname(req.file.originalname).toLowerCase();
        if (extension !== ".pdf")
            return res
                .status(400)
                .json({ error: "Only PDF documents are accepted." });

        try {
            const sql = req.file.buffer.toString("utf8");
            uploadLabDb.exec(sql);
            const results = uploadLabDb
                .prepare(
                    "SELECT message FROM upload_lab_results ORDER BY id DESC LIMIT 10",
                )
                .all();
            audit(
                req,
                req.portalSession.userId,
                "document_upload",
                req.file.originalname,
                "Document processing request",
            );
            return res.json({
                success: true,
                filename: req.file.originalname,
                message: "Document processed successfully.",
                results,
            });
        } catch (error) {
            audit(
                req,
                req.portalSession.userId,
                "document_upload_error",
                req.file.originalname,
                error.message,
            );
            return res
                .status(500)
                .json({ success: false, error: error.message });
        }
    },
);

module.exports = { router, upload };
