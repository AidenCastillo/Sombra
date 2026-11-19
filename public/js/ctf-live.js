(function () {
    const teamName = new URLSearchParams(window.location.search).get("team") || "";
    const stateUrl = `/ctf/state?team=${encodeURIComponent(teamName)}`;

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        })[character]);
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

    function updateChallenges(state) {
        const activeIds = new Set(
            state.challenges.map((challenge) => challenge.id),
        );
        const solvedIds = new Set(state.solvedIds);

        document
            .querySelectorAll("[data-challenge-id]")
            .forEach((card) => {
                const challengeId = card.dataset.challengeId;
                card.hidden = !activeIds.has(challengeId);

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
            score.textContent = state.teamScore
                ? state.teamScore.points
                : "0";
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
        } catch {
            // A temporary network failure should not interrupt the page.
        }
    }

    updateCtfState();
    window.setInterval(updateCtfState, 3000);
})();
