const express = require("express");
const crypto = require("node:crypto");

const router = express.Router();

const db = require("../db/connection");
const challenges = require("../challenges/registry");

// Never send challenge flags to the browser.
function publicChallenges() {
    return challenges.map(({ flag, ...challenge }) => challenge);
}

function getLeaderboard() {
    const rows = db
        .prepare(
            `
        SELECT
            t.team_name,
            s.challenge_id,
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

        score.points += challenge.points;
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

// GET /ctf
router.get("/ctf", (req, res) => {
    const teamName = String(req.query.team || "").trim();

    let solvedIds = [];

    if (teamName) {
        const team = db
            .prepare(
                `
            SELECT id
            FROM ctf_teams
            WHERE team_name = ?
        `,
            )
            .get(teamName);

        if (team) {
            solvedIds = db
                .prepare(
                    `
                SELECT challenge_id
                FROM ctf_solves
                WHERE team_id = ?
            `,
                )
                .all(team.id)
                .map((row) => row.challenge_id);
        }
    }

    const leaderboard = getLeaderboard();

    const teamScore = leaderboard.find(
        (entry) => entry.teamName.toLowerCase() === teamName.toLowerCase(),
    );

    res.render("ctf", {
        challenges: publicChallenges(),
        leaderboard: leaderboard.slice(0, 10),
        teamName,
        teamScore: teamScore || null,
        solvedIds,
        status: req.query.status || null,
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
        return res
            .status(400)
            .send(
                "Team name must be 2–32 characters and contain only letters, numbers, spaces, underscores, or hyphens.",
            );
    }

    const challenge = challenges.find((c) => c.id === challengeId);

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
        SELECT id, team_name
        FROM ctf_teams
        WHERE team_name = ?
    `,
        )
        .get(teamName);

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

    // Compare flags without exposing the expected value.
    const expected = Buffer.from(challenge.flag);
    const submitted = Buffer.from(submittedFlag);

    const correct =
        expected.length === submitted.length &&
        crypto.timingSafeEqual(expected, submitted);

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

    // Record the successful solve.
    db.prepare(
        `
        INSERT INTO ctf_solves (
            team_id,
            challenge_id
        )
        VALUES (?, ?)
    `,
    ).run(team.id, challengeId);

    return redirect("correct");
});

module.exports = router;
