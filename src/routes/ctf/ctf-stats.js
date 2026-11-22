const db = require("../../db/ctf_connection");
const challenges = require("../../challenges/registry");

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

function getGamemasterState(teamId = null) {
    const rows = db
        .prepare("SELECT key, value FROM ctf_gamemaster_state")
        .all();

    const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const reverseUntil = Number(state.reverse_until || 0);
    const reverseTeamId = Number(state.reverse_team_id || 0);
    const reverseActive =
        teamId &&
        reverseTeamId === Number(teamId) &&
        reverseUntil > Date.now() &&
        ["captcha", "scramble", "throttle", "blackout"].includes(
            state.reverse_effect,
        );

    return {
        banner: state.banner || "",
        incidentMode: state.incident_mode === "1",
        watchMode: state.watch_mode === "1",
        handicapMode: state.handicap_mode === "1",
        freezeMode: state.freeze_mode === "1",
        showRoutes: state.show_routes === "1",
        gameEnded: state.game_ended === "1",
        reverseEffect: reverseActive ? state.reverse_effect : "none",
        reverseUntil: reverseActive ? reverseUntil : 0,
        reverseNonce: reverseActive ? state.reverse_nonce || "" : "",
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

module.exports = {
    publicChallenges,
    getGamemasterState,
    getLeaderboard,
    getTeamState,
};
