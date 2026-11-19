const express = require("express");
const crypto = require("node:crypto");

const db = require("../db/ctf_connection");
const challenges = require("../challenges/registry");

const router = express.Router();
const COOKIE_NAME = "gm_session";
const SESSION_SECRET =
    process.env.SESSION_SECRET || "development-session-secret";

function sign(value) {
    return crypto
        .createHmac("sha256", SESSION_SECRET)
        .update(value)
        .digest("hex");
}

function createSessionCookie() {
    const payload = Buffer.from(
        JSON.stringify({
            role: "gamemaster",
            exp: Date.now() + 8 * 60 * 60 * 1000,
        }),
    ).toString("base64url");

    return `${payload}.${sign(payload)}`;
}

function isAuthenticated(req) {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));

    if (!cookie) return false;

    const token = cookie.slice(COOKIE_NAME.length + 1);
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;

    const expected = sign(payload);
    const provided = Buffer.from(signature);
    const actual = Buffer.from(expected);
    if (
        provided.length !== actual.length ||
        !crypto.timingSafeEqual(provided, actual)
    ) {
        return false;
    }

    try {
        const session = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8"),
        );
        return session.role === "gamemaster" && session.exp > Date.now();
    } catch {
        return false;
    }
}

function requireGamemaster(req, res, next) {
    if (isAuthenticated(req)) return next();

    res.redirect("/gamemaster/login");
}

function getState() {
    const rows = db
        .prepare("SELECT key, value FROM ctf_gamemaster_state")
        .all();
    const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
        banner: state.banner || "",
        incidentMode: state.incident_mode === "1",
        watchMode: state.watch_mode === "1",
        handicapMode: state.handicap_mode === "1",
        freezeMode: state.freeze_mode === "1",
        showRoutes: state.show_routes === "1",
    };
}

function setState(key, value) {
    db.prepare(
        `
        INSERT INTO ctf_gamemaster_state (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
    `,
    ).run(key, value);
}

router.get("/gamemaster/login", (req, res) => {
    if (isAuthenticated(req)) return res.redirect("/gamemaster");

    res.render("gamemaster-login", { error: req.query.error === "1" });
});

router.post("/gamemaster/login", (req, res) => {
    const password = String(req.body.password || "");
    const configured = process.env.GM_PASSWORD || "sombra-blue-team";
    const passwordBuffer = Buffer.from(password);
    const configuredBuffer = Buffer.from(configured);

    const valid =
        passwordBuffer.length === configuredBuffer.length &&
        crypto.timingSafeEqual(passwordBuffer, configuredBuffer);

    if (!valid) return res.redirect("/gamemaster/login?error=1");

    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${createSessionCookie()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`,
    );
    res.redirect("/gamemaster");
});

router.post("/gamemaster/logout", (req, res) => {
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    res.redirect("/gamemaster/login");
});

router.get("/gamemaster", requireGamemaster, (req, res) => {
    const teams = db
        .prepare(
            `
        SELECT
            t.id,
            t.team_name,
            t.active,
            t.created_at,
            COUNT(DISTINCT s.id) AS solved,
            COUNT(DISTINCT s.points_awarded) AS ignored,
            COALESCE(SUM(s.points_awarded), 0) AS points
        FROM ctf_teams t
        LEFT JOIN ctf_solves s ON s.team_id = t.id
        GROUP BY t.id
        ORDER BY points DESC, t.team_name ASC
    `,
        )
        .all();

    const dbChallenges = db
        .prepare(
            "SELECT id, title, category, points, active FROM ctf_challenges ORDER BY title",
        )
        .all();

    const recentAttempts = db
        .prepare(
            `
        SELECT
            t.team_name,
            c.title AS challenge_title,
            a.is_correct,
            a.submitted_at
        FROM ctf_attempts a
        JOIN ctf_teams t ON t.id = a.team_id
        JOIN ctf_challenges c ON c.id = a.challenge_id
        ORDER BY a.submitted_at DESC, a.id DESC
        LIMIT 12
    `,
        )
        .all();

    res.render("gamemaster", {
        state: getState(),
        teams,
        challenges: dbChallenges,
        attempts: recentAttempts,
        challengeCount: challenges.length,
    });
});

router.post("/gamemaster/broadcast", requireGamemaster, (req, res) => {
    setState(
        "banner",
        String(req.body.banner || "")
            .trim()
            .slice(0, 200),
    );
    res.redirect("/gamemaster");
});

router.post("/gamemaster/mode", requireGamemaster, (req, res) => {
    setState("incident_mode", req.body.incidentMode === "1" ? "1" : "0");
    setState("watch_mode", req.body.watchMode === "1" ? "1" : "0");
    res.redirect("/gamemaster");
});

router.post("/gamemaster/challenge", requireGamemaster, (req, res) => {
    const challengeId = String(req.body.challengeId || "");
    const active = req.body.active === "1" ? 1 : 0;
    db.prepare("UPDATE ctf_challenges SET active = ? WHERE id = ?").run(
        active,
        challengeId,
    );
    res.redirect("/gamemaster");
});

router.post("/gamemaster/team", requireGamemaster, (req, res) => {
    const teamId = Number(req.body.teamId);
    if (!Number.isInteger(teamId)) return res.status(400).send("Invalid team.");

    if (req.body.action === "deactivate") {
        db.prepare("UPDATE ctf_teams SET active = 0 WHERE id = ?").run(teamId);
    } else if (req.body.action === "activate") {
        db.prepare("UPDATE ctf_teams SET active = 1 WHERE id = ?").run(teamId);
    } else if (req.body.action === "reset") {
        const transaction = db.transaction(() => {
            db.prepare("DELETE FROM ctf_solves WHERE team_id = ?").run(teamId);
            db.prepare("DELETE FROM ctf_attempts WHERE team_id = ?").run(
                teamId,
            );
        });
        transaction();
    }

    res.redirect("/gamemaster");
});

router.post("/gamemaster/game_control", requireGamemaster, (req, res) => {
    setState("handicap_mode", req.body.handicapMode === "1" ? "1" : "0");
    setState("freeze_mode", req.body.freezeMode === "1" ? "1" : "0");
    setState("show_routes", req.body.showRoutes === "1" ? "1" : "0");
    res.redirect("/gamemaster");
});

module.exports = router;
