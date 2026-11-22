(function () {
    let participantUsername = null;
    const stateUrl = "/ctf/state";

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

    function updateEndGame(state) {
        const section = document.getElementById("end-game");
        if (!section) return;
        section.hidden = !state.gamemaster.gameEnded;
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

            // Freeze: disable submissions (a participant must be signed in).
            const submit = card.querySelector(".flag-form button");
            if (submit) submit.disabled = freeze || !participantUsername;

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

    let reverseSignature = "";
    let captchaSolvedSignature = "";
    let captchaRoundIndex = 0;
    let captchaWrongLockUntil = 0;
    let reverseCountdownTimer = null;

    function getCaptchaRound(nonce, round) {
        const seed = nonce || "SOMBRA";
        const a = (seed.charCodeAt(0) % 8) + 3;
        const b = (seed.charCodeAt(1) % 9) + 2;
        const code =
            (seed.replace(/[^A-Za-z0-9]/g, "").toUpperCase() + "SOMBRA").slice(0, 6);

        if (round === 0) {
            return { prompt: code, answer: code, label: "Round 1/3 · Enter the verification code" };
        }
        if (round === 1) {
            return { prompt: `${a} + ${b} = ?`, answer: String(a + b), label: "Round 2/3 · Solve the security check" };
        }
        return { prompt: "SOMBRA-BLUE-7", answer: "SOMBRA-BLUE-7", label: "Round 3/3 · Transcribe the final phrase" };
    }

    function updateReverseEffect(gamemaster) {
        const effect = gamemaster.reverseEffect || "none";
        const until = Number(gamemaster.reverseUntil || 0);
        const nonce = gamemaster.reverseNonce || "";
        const signature = `${effect}:${until}:${nonce}`;

        document.body.classList.remove(
            "reverse-scramble",
            "reverse-throttle",
        );

        const overlay = document.getElementById("reverse-overlay");
        const captchaPanel = document.getElementById("captcha-panel");
        const title = document.getElementById("reverse-overlay-title");
        const copy = document.getElementById("reverse-overlay-copy");
        const countdown = document.getElementById("reverse-countdown");
        if (!overlay) return;

        if (effect === "none" || until <= Date.now()) {
            overlay.hidden = true;
            captchaPanel.hidden = true;
            document.querySelectorAll(".flag-form button").forEach((button) => {
                button.disabled = !participantUsername || Boolean(gamemaster.freezeMode);
            });
            if (reverseCountdownTimer) {
                window.clearInterval(reverseCountdownTimer);
                reverseCountdownTimer = null;
            }
            return;
        }

        if (reverseSignature !== signature) {
            reverseSignature = signature;
            captchaRoundIndex = 0;
            captchaWrongLockUntil = 0;
            const challenge = getCaptchaRound(nonce, captchaRoundIndex);
            const captchaCode = document.getElementById("captcha-code");
            if (captchaCode) captchaCode.textContent = challenge.prompt;
            if (copy) copy.textContent = challenge.label;
            const answer = document.getElementById("captcha-answer");
            if (answer) answer.value = "";
        }

        if (effect === "captcha") {
            if (captchaSolvedSignature === signature) {
                overlay.hidden = true;
                captchaPanel.hidden = true;
                document.querySelectorAll(".flag-form button").forEach((button) => {
                    button.disabled = !participantUsername || Boolean(gamemaster.freezeMode);
                });
            } else {
                overlay.hidden = false;
                captchaPanel.hidden = false;
                title.textContent = "Security Verification Required";
                document.querySelectorAll(".flag-form button").forEach((button) => {
                    button.disabled = true;
                });
            }
        } else if (effect === "scramble") {
            overlay.hidden = true;
            captchaPanel.hidden = true;
            document.body.classList.add("reverse-scramble");
        } else if (effect === "throttle") {
            overlay.hidden = true;
            captchaPanel.hidden = true;
            document.body.classList.add("reverse-throttle");
            document.querySelectorAll(".flag-form button").forEach((button) => {
                button.disabled = true;
            });
        } else if (effect === "blackout") {
            overlay.hidden = false;
            captchaPanel.hidden = true;
            title.textContent = "Portal Temporarily Blacked Out";
            copy.textContent = "Blue Team has interrupted this portal.";
            document.querySelectorAll(".flag-form button").forEach((button) => {
                button.disabled = true;
            });
        }

        if (reverseCountdownTimer) window.clearInterval(reverseCountdownTimer);
        reverseCountdownTimer = window.setInterval(() => {
            const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            countdown.textContent = remaining
                ? `Countermeasure expires in ${remaining}s`
                : "";
            if (remaining === 0) updateCtfState();
        }, 250);

        const verify = document.getElementById("captcha-submit");
        if (verify && !verify.dataset.bound) {
            verify.dataset.bound = "1";
            verify.addEventListener("click", () => {
                if (Date.now() < captchaWrongLockUntil) return;
                const answer = document.getElementById("captcha-answer");
                const challenge = getCaptchaRound(nonce, captchaRoundIndex);
                if (answer.value.trim().toUpperCase() === challenge.answer) {
                    captchaRoundIndex += 1;
                    if (captchaRoundIndex >= 3) {
                        captchaSolvedSignature = signature;
                        overlay.hidden = true;
                        document.querySelectorAll(".flag-form button").forEach((button) => {
                            button.disabled = !participantUsername || Boolean(gamemaster.freezeMode);
                        });
                        updateCtfState();
                    } else {
                        const next = getCaptchaRound(nonce, captchaRoundIndex);
                        document.getElementById("captcha-code").textContent = next.prompt;
                        copy.textContent = next.label;
                        answer.value = "";
                        answer.placeholder = "Enter answer";
                        answer.focus();
                    }
                } else {
                    captchaWrongLockUntil = Date.now() + 1500;
                    answer.value = "";
                    answer.placeholder = "Incorrect - 1.5 second delay";
                    answer.focus();
                }
            });
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
            participantUsername = state.username;
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

            updateReverseEffect(state.gamemaster);

            renderRoutes(state.gamemaster, state.routes || []);
        } catch {
            // A temporary network failure should not interrupt the page.
        }
    }

    updateCtfState();
    window.setInterval(updateCtfState, 3000);
})();
