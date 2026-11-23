const express = require("express");
const crypto = require("node:crypto");

const router = express.Router();

const db = require("../../db/ctf_connection");
const challenges = require("../../challenges/registry");
const { hashPassword, verifyPassword } = require("../../auth/passwords");
const {
    publicChallenges,
    getGamemasterState,
    getLeaderboard,
    getTeamState,
} = require("./ctf-stats");

const CTF_COOKIE_NAME = "ctf_session";
const CTF_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function readParticipantSession(req) {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${CTF_COOKIE_NAME}=`));
    if (!cookie) return null;

    const token = cookie.slice(CTF_COOKIE_NAME.length + 1);
    if (!token) return null;

    db.prepare("DELETE FROM ctf_sessions WHERE expires_at <= ?").run(
        Date.now(),
    );

    const tokenHash = crypto
        .createHash("sha256")
        .update(decodeURIComponent(token))
        .digest("hex");
    const participant = db
        .prepare(
            `
            SELECT p.id, p.username, p.team_id, p.active AS player_active,
                   t.team_name, t.active AS team_active
            FROM ctf_sessions s
            JOIN ctf_players p ON p.id = s.player_id
            JOIN ctf_teams t ON t.id = p.team_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND p.active = 1
        `,
        )
        .get(tokenHash, Date.now());

    if (!participant) return null;

    const now = Date.now();
    db.prepare("UPDATE ctf_players SET last_seen = ? WHERE id = ?").run(
        now,
        participant.id,
    );
    db.prepare(
        "UPDATE ctf_sessions SET expires_at = ? WHERE token_hash = ?",
    ).run(now + CTF_SESSION_TTL_MS, tokenHash);

    return participant;
}

function createParticipantSession(res, participant) {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = Date.now();

    db.prepare("DELETE FROM ctf_sessions WHERE player_id = ?").run(
        participant.id,
    );
    db.prepare(
        `
        INSERT INTO ctf_sessions (token_hash, player_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
    `,
    ).run(tokenHash, participant.id, now + CTF_SESSION_TTL_MS, now);
    db.prepare("UPDATE ctf_players SET last_seen = ? WHERE id = ?").run(
        now,
        participant.id,
    );

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
        "Set-Cookie",
        `${CTF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(CTF_SESSION_TTL_MS / 1000)}${secure}`,
    );
}

const HIDDEN_PREFIXES = ["/gamemaster", "/ctf"];

function getVisibleRoutes(app) {
    let root;
    try {
        root = app.router;
    } catch {}
    root = root || app._router;
    if (!root || !root.stack) return [];

    const found = [];
    (function walk(stack, prefix = "") {
        for (const layer of stack) {
            if (layer.route) {
                found.push({
                    path: prefix + layer.route.path,
                    methods: Object.keys(layer.route.methods).map((m) =>
                        m.toUpperCase(),
                    ),
                });
            } else if (layer.handle && layer.handle.stack) {
                walk(layer.handle.stack, prefix);
            }
        }
    })(root.stack);

    return found
        .filter(
            (r) =>
                typeof r.path === "string" &&
                !HIDDEN_PREFIXES.some((p) => r.path.startsWith(p)),
        )
        .sort((a, b) => a.path.localeCompare(b.path));
}

// GET /ctf
router.get("/ctf", (req, res) => {
    const participant = readParticipantSession(req);
    const teamName = participant?.team_name || "";
    const teamState = getTeamState(teamName);
    const leaderboard = getLeaderboard();
    const gamemaster = getGamemasterState(participant?.team_id);

    res.render("ctf/ctf", {
        layout: "layouts/ctf",
        challenges: publicChallenges(),
        leaderboard: leaderboard.slice(0, 10),
        participant,
        teamName,
        teamScore: teamState.teamScore,
        solvedIds: teamState.solvedIds,
        status: req.query.status || null,
        gamemaster: gamemaster,
        routes: gamemaster.showRoutes ? getVisibleRoutes(req.app) : [],
    });
});

router.post("/ctf/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const teamName = String(req.body.teamName || "").trim();

    if (
        username.length < 3 ||
        username.length > 32 ||
        !/^[a-zA-Z0-9._-]+$/.test(username)
    ) {
        return res
            .status(400)
            .send(
                "Username must be 3–32 letters, numbers, dots, underscores, or hyphens.",
            );
    }
    if (password.length < 8 || password.length > 128) {
        return res.status(400).send("Password must be 8–128 characters.");
    }
    if (
        teamName.length < 2 ||
        teamName.length > 32 ||
        !/^[a-zA-Z0-9 _-]+$/.test(teamName)
    ) {
        return res
            .status(400)
            .send(
                "Team name must be 2–32 letters, numbers, spaces, underscores, or hyphens.",
            );
    }

    const existing = db
        .prepare("SELECT id FROM ctf_players WHERE username = ?")
        .get(username);
    if (existing) {
        return res.status(409).send("That username is already registered.");
    }

    const transaction = db.transaction(() => {
        db.prepare(
            "INSERT OR IGNORE INTO ctf_teams (team_name) VALUES (?)",
        ).run(teamName);
        const team = db
            .prepare(
                "SELECT id, team_name, active FROM ctf_teams WHERE team_name = ?",
            )
            .get(teamName);
        if (!team.active) {
            throw new Error("Team disabled");
        }
        const result = db
            .prepare(
                `
            INSERT INTO ctf_players (username, password_hash, team_id)
            VALUES (?, ?, ?)
        `,
            )
            .run(username, hashPassword(password), team.id);
        return db
            .prepare(
                `
                SELECT p.id, p.username, p.team_id, p.active AS player_active,
                       t.team_name, t.active AS team_active
                FROM ctf_players p
                JOIN ctf_teams t ON t.id = p.team_id
                WHERE p.id = ?
            `,
            )
            .get(result.lastInsertRowid);
    });

    try {
        const participant = transaction();
        createParticipantSession(res, participant);
        res.redirect("/ctf");
    } catch (error) {
        if (error.message === "Team disabled") {
            return res.status(403).send("This team has been disabled.");
        }
        if (String(error).includes("UNIQUE")) {
            return res.status(409).send("That username is already registered.");
        }
        throw error;
    }
});

router.post("/ctf/login", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const player = db
        .prepare(
            `
            SELECT p.id, p.username, p.password_hash, p.team_id, p.active AS player_active,
                   t.team_name, t.active AS team_active
            FROM ctf_players p
            JOIN ctf_teams t ON t.id = p.team_id
            WHERE p.username = ?
        `,
        )
        .get(username);

    if (
        !player ||
        !player.player_active ||
        !verifyPassword(password, player.password_hash)
    ) {
        return res.status(401).send("Invalid username or password.");
    }
    if (!player.team_active) {
        return res
            .status(403)
            .send("This participant's team has been disabled.");
    }

    createParticipantSession(res, player);
    res.redirect("/ctf");
});

router.post("/ctf/logout", (req, res) => {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${CTF_COOKIE_NAME}=`));
    if (cookie) {
        const token = decodeURIComponent(
            cookie.slice(CTF_COOKIE_NAME.length + 1),
        );
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");
        db.prepare("DELETE FROM ctf_sessions WHERE token_hash = ?").run(
            tokenHash,
        );
    }
    res.setHeader(
        "Set-Cookie",
        `${CTF_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    res.redirect("/ctf");
});

// End game survey
router.get("/ctf/end-game", (req, res) => {
    const participant = readParticipantSession(req);
    const teamName = participant?.team_name || "";
    const teamState = getTeamState(teamName);
    const gamemaster = getGamemasterState(participant?.team_id);

    res.render("ctf/ctf-end-game-survey", {
        layout: "layouts/ctf",
        teamName,
        teamScore: teamState.teamScore,
        gamemaster,
    });
});

const fs = require("fs").promises;
const path = require("path");

const SURVEY_FILE = path.join(__dirname, "../../../data/survey_responses.json");
router.post("/ctf/end-game", async (req, res) => {
    const participant = readParticipantSession(req);
    const teamName = participant?.team_name || "Anonymous";
    const teamState = getTeamState(teamName);
    const gamemaster = getGamemasterState(participant?.team_id);

    const newEntry = {
        submittedAt: new Date().toISOString(),
        teamName: teamName || "Anonymous",
        teamScore: teamState?.teamScore ?? 0,
        gamemaster,
        responses: req.body,
    };

    try {
        let allResponses = [];

        // Read existing responses if the file already exists
        try {
            const fileData = await fs.readFile(SURVEY_FILE, "utf8");
            allResponses = JSON.parse(fileData);
            if (!Array.isArray(allResponses)) {
                allResponses = [];
            }
        } catch (readErr) {
            // Ignore ENOENT (file doesn't exist yet); rethrow other errors
            if (readErr.code !== "ENOENT") throw readErr;
        }

        // Add the new response and write back valid JSON
        allResponses.push(newEntry);
        await fs.writeFile(
            SURVEY_FILE,
            JSON.stringify(allResponses, null, 2),
            "utf8",
        );
    } catch (err) {
        console.error("Error saving survey:", err);
    }

    res.redirect("/ctf");
});

// GET /ctf/state
router.get("/ctf/state", (req, res) => {
    const participant = readParticipantSession(req);
    const teamName = participant?.team_name || "";
    const teamState = getTeamState(teamName);

    const gamemaster = getGamemasterState(participant?.team_id);

    res.json({
        challenges: publicChallenges(),
        leaderboard: getLeaderboard().slice(0, 10),
        teamName,
        username: participant?.username || null,
        teamScore: teamState.teamScore,
        solvedIds: teamState.solvedIds,
        gamemaster,
        routes: gamemaster.showRoutes ? getVisibleRoutes(req.app) : [],
    });
});

// POST /ctf/submit
router.post("/ctf/submit", (req, res) => {
    const participant = readParticipantSession(req);
    const teamName = participant?.team_name || "";
    const challengeId = String(req.body.challengeId || "").trim();
    const submittedFlag = String(req.body.flag || "").trim();

    const redirect = (status) => {
        res.redirect(`/ctf?status=${status}`);
    };

    if (!participant) {
        return res.status(401).redirect("/ctf");
    }
    if (!participant.team_active || !participant.player_active) {
        return res.status(403).send("This participant is no longer active.");
    }
    const gamemaster = getGamemasterState(participant.team_id);
    if (gamemaster.freezeMode) {
        return redirect("frozen");
    }
    if (gamemaster.reverseEffect === "throttle") {
        return redirect("throttled");
    }
    if (
        gamemaster.reverseEffect === "captcha" &&
        String(req.body.reverseProof || "") !== gamemaster.reverseNonce
    ) {
        return redirect("captcha");
    }

    const challenge = db
        .prepare(
            `
        SELECT id, title, category, difficulty, points, flag_hash
        FROM ctf_challenges
        WHERE id = ? AND active = 1
        `,
        )
        .get(challengeId);

    if (!challenge) {
        return res.status(404).send("Challenge not found.");
    }

    if (!submittedFlag || submittedFlag.length > 200) {
        return redirect("invalid");
    }

    // Create the team if it doesn't exist.
    db.prepare(
        `
        INSERT OR IGNORE INTO ctf_teams (team_name)
        VALUES (?)
    `,
    ).run(teamName);

    const team = db
        .prepare(
            `
        SELECT id, team_name, active
        FROM ctf_teams
        WHERE team_name = ?
    `,
        )
        .get(teamName);

    if (!team.active) {
        return res
            .status(403)
            .send("This team has been disabled by Blue Team.");
    }

    // Check whether this challenge has already been solved.
    const existingSolve = db
        .prepare(
            `
        SELECT id
        FROM ctf_solves
        WHERE team_id = ? AND challenge_id = ?
    `,
        )
        .get(team.id, challengeId);

    if (existingSolve) {
        return redirect("already-solved");
    }

    // Compare submitted flag against stored SHA-256 hash.
    const submittedHash = crypto
        .createHash("sha256")
        .update(submittedFlag)
        .digest("hex");

    const correct = crypto.timingSafeEqual(
        Buffer.from(challenge.flag_hash, "hex"),
        Buffer.from(submittedHash, "hex"),
    );

    // Record the attempt.
    db.prepare(
        `
        INSERT INTO ctf_attempts (
            team_id,
            challenge_id,
            is_correct
        )
        VALUES (?, ?, ?)
    `,
    ).run(team.id, challengeId, correct ? 1 : 0);

    if (!correct) {
        return redirect("incorrect");
    }

    const awarded = gamemaster.handicapMode
        ? Math.floor(challenge.points / 2)
        : challenge.points;
    // Record the successful solve.
    db.prepare(
        `
    INSERT INTO ctf_solves (
        team_id,
        challenge_id,
        points_awarded
    )
    VALUES (?, ?, ?)
    `,
    ).run(team.id, challengeId, awarded);

    return redirect("correct");
});

module.exports = router;
