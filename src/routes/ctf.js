const express = require("express");
const crypto = require("node:crypto");

const router = express.Router();

const db = require("../db/ctf_connection");
const challenges = require("../challenges/registry");

// Never send challenge flags to the browser.
function publicChallenges() {
    const activeIds = new Set(
        db
            .prepare("SELECT id FROM ctf_challenges WHERE active = 1")
            .all()
            .map((row) => row.id),
    );

    return challenges
        .filter((challenge) => activeIds.has(challenge.id))
        .map(({ flag, ...challenge }) => challenge);
}

function getGamemasterState() {
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
        gameEnded: state.game_ended === "1",
    };
}

function getLeaderboard() {
    const rows = db
        .prepare(
            `
        SELECT
            t.team_name,
            s.challenge_id,
            s.points_awarded,
            s.solved_at
        FROM ctf_teams t
        LEFT JOIN ctf_solves s ON s.team_id = t.id
    `,
        )
        .all();

    const scores = new Map();

    for (const row of rows) {
        if (!scores.has(row.team_name)) {
            scores.set(row.team_name, {
                teamName: row.team_name,
                points: 0,
                solved: 0,
                lastSolved: null,
            });
        }

        if (!row.challenge_id) continue;

        const score = scores.get(row.team_name);
        const challenge = challenges.find((c) => c.id === row.challenge_id);

        if (!challenge) continue;

        score.points += row.points_awarded || challenge.points;
        score.solved += 1;

        if (!score.lastSolved || row.solved_at < score.lastSolved) {
            score.lastSolved = row.solved_at;
        }
    }

    return [...scores.values()].sort(
        (a, b) =>
            b.points - a.points ||
            b.solved - a.solved ||
            a.teamName.localeCompare(b.teamName),
    );
}

function getTeamState(teamName) {
    if (!teamName) {
        return { solvedIds: [], teamScore: null };
    }

    const team = db
        .prepare("SELECT id FROM ctf_teams WHERE team_name = ?")
        .get(teamName);

    if (!team) {
        return { solvedIds: [], teamScore: null };
    }

    const solvedIds = db
        .prepare("SELECT challenge_id FROM ctf_solves WHERE team_id = ?")
        .all(team.id)
        .map((row) => row.challenge_id);
    const leaderboard = getLeaderboard();

    return {
        solvedIds,
        teamScore:
            leaderboard.find(
                (entry) =>
                    entry.teamName.toLowerCase() === teamName.toLowerCase(),
            ) || null,
    };
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
    const teamName = String(req.query.team || "").trim();
    const teamState = getTeamState(teamName);
    const leaderboard = getLeaderboard();
    const gamemaster = getGamemasterState();

    res.render("ctf", {
        challenges: publicChallenges(),
        leaderboard: leaderboard.slice(0, 10),
        teamName,
        teamScore: teamState.teamScore,
        solvedIds: teamState.solvedIds,
        status: req.query.status || null,
        gamemaster: gamemaster,
        routes: gamemaster.showRoutes ? getVisibleRoutes(req.app) : [],
    });
});

// End game survey
router.get("/ctf/end-game", (req, res) => {
    const teamName = String(req.query.team || "").trim();
    const teamState = getTeamState(teamName);
    const gamemaster = getGamemasterState();

    res.render("ctf-end-game-survey", {
        teamName,
        teamScore: teamState.teamScore,
        gamemaster,
    });
});

const fs = require("fs").promises;
const path = require("path");

const SURVEY_FILE = path.join(__dirname, "survey_responses.json");
router.post("/ctf/end-game", async (req, res) => {
    const teamName = String(req.body.teamName || "").trim();
    const teamState = getTeamState(teamName);
    const gamemaster = getGamemasterState();

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

    res.redirect(`/ctf?team=${encodeURIComponent(teamName)}`);
});

// GET /ctf/state
router.get("/ctf/state", (req, res) => {
    const teamName = String(req.query.team || "").trim();
    const teamState = getTeamState(teamName);

    const gamemaster = getGamemasterState();

    res.json({
        challenges: publicChallenges(),
        leaderboard: getLeaderboard().slice(0, 10),
        teamName,
        teamScore: teamState.teamScore,
        solvedIds: teamState.solvedIds,
        gamemaster,
        routes: gamemaster.showRoutes ? getVisibleRoutes(req.app) : [],
    });
});

// POST /ctf/submit
router.post("/ctf/submit", (req, res) => {
    const teamName = String(req.body.teamName || "").trim();
    const challengeId = String(req.body.challengeId || "").trim();
    const submittedFlag = String(req.body.flag || "").trim();

    const redirect = (status) => {
        res.redirect(
            `/ctf?team=${encodeURIComponent(teamName)}&status=${status}`,
        );
    };

    // Validate team name.
    if (
        teamName.length < 2 ||
        teamName.length > 32 ||
        !/^[a-zA-Z0-9 _-]+$/.test(teamName)
    ) {
        if (getGamemasterState().freezeMode) {
            return redirect("frozen");
        }
        return res
            .status(400)
            .send(
                "Team name must be 2–32 characters and contain only letters, numbers, spaces, underscores, or hyphens.",
            );
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

    const awarded = getGamemasterState().handicapMode
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
