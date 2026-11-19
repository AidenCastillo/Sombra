(function () {
    const teamName =
        new URLSearchParams(window.location.search).get("team") || "";
    const stateUrl = `/ctf/state?team=${encodeURIComponent(teamName)}`;

    function escapeHtml(value) {
        return String(value).replace(
            /[&<>"']/g,
            (character) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[character],
        );
    }

    function renderLeaderboard(leaderboard) {
        const body = document.getElementById("leaderboard-body");
        if (!body) return;

        body.replaceChildren();
        if (!leaderboard.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="4">No teams have scored yet.</td>';
            body.append(row);
            return;
        }

        leaderboard.forEach((team, index) => {
            const row = document.createElement("tr");
            row.innerHTML =
                `<td>#${index + 1}</td>` +
                `<td>${escapeHtml(team.teamName)}</td>` +
                `<td>${team.solved}</td>` +
                `<td>${team.points}</td>`;
            body.append(row);
        });
    }

    function renderRoutes(gamemaster, routes) {
        const section = document.getElementById("routes-section");
        const list = document.getElementById("routes-list");
        if (!section || !list) return;

        const visible = Boolean(gamemaster.showRoutes) && routes.length > 0;
        section.hidden = !visible;

        // Skip the rebuild when nothing changed to avoid flicker.
        const signature = JSON.stringify(visible ? routes : []);
        if (list.dataset.signature === signature) return;
        list.dataset.signature = signature;

        list.replaceChildren();
        if (!visible) return;

        routes.forEach((route) => {
            const row = document.createElement("div");
            row.className = "route-row";

            const methods = document.createElement("span");
            methods.className = "route-methods";
            methods.textContent = route.methods.join(", ");

            const path = document.createElement("code");
            path.textContent = route.path;

            row.append(methods, path);
            list.append(row);
        });
    }

    function updateChallenges(state) {
        const activeIds = new Set(
            state.challenges.map((challenge) => challenge.id),
        );
        const solvedIds = new Set(state.solvedIds);

        const freeze = Boolean(state.gamemaster.freezeMode);
        const handicap = Boolean(state.gamemaster.handicapMode);
        const pointsById = new Map(
            state.challenges.map((challenge) => [
                challenge.id,
                challenge.points,
            ]),
        );

        document.querySelectorAll("[data-challenge-id]").forEach((card) => {
            const challengeId = card.dataset.challengeId;
            card.hidden = !activeIds.has(challengeId);

            // Handicap display: halve the shown point value.
            const pointsEl = card.querySelector(".points");
            if (pointsEl && pointsById.has(challengeId)) {
                const base = pointsById.get(challengeId);
                pointsEl.textContent = `${handicap ? Math.floor(base / 2) : base} PTS`;
                if (handicap) {
                    const tag = document.createElement("span");
                    tag.className = "handicap-tag";
                    tag.textContent = "HANDICAP";
                    pointsEl.append(tag);
                }
            }

            // Freeze: disable submissions (a team must also be loaded).
            const submit = card.querySelector(".flag-form button");
            if (submit) submit.disabled = freeze || !teamName;

            if (!solvedIds.has(challengeId)) return;

            card.classList.add("solved");
            const form = card.querySelector(".flag-form");
            if (form) {
                form.remove();
                const label = document.createElement("div");
                label.className = "solved-label";
                label.textContent = "✓ COMPLETED";
                card.append(label);
            }
        });

        const available = document.getElementById("available-challenges");
        if (available) available.textContent = state.challenges.length;

        const solved = document.getElementById("solved-challenges");
        if (solved) solved.textContent = state.solvedIds.length;

        const score = document.getElementById("team-score");
        if (score) {
            score.textContent = state.teamScore ? state.teamScore.points : "0";
        }
    }

    async function updateCtfState() {
        try {
            const response = await fetch(stateUrl, {
                headers: { Accept: "application/json" },
                cache: "no-store",
            });
            if (!response.ok) return;

            const state = await response.json();
            updateChallenges(state);
            renderLeaderboard(state.leaderboard);

            const incident = document.getElementById("incident-banner");
            if (incident) incident.hidden = !state.gamemaster.incidentMode;

            const watch = document.getElementById("watch-indicator");
            if (watch) watch.hidden = !state.gamemaster.watchMode;

            const broadcast = document.getElementById("broadcast-banner");
            if (broadcast) {
                broadcast.textContent = state.gamemaster.banner;
                broadcast.hidden = !state.gamemaster.banner;
            }

            const freezeNotice = document.getElementById("freeze-notice");
            if (freezeNotice) {
                freezeNotice.hidden = !state.gamemaster.freezeMode;
            }

            renderRoutes(state.gamemaster, state.routes || []);
        } catch {
            // A temporary network failure should not interrupt the page.
        }
    }

    updateCtfState();
    window.setInterval(updateCtfState, 3000);
})();
