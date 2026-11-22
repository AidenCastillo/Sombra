(function () {
    const stateUrl = "/portal/live-state";
    let solvedNonce = "";
    let activeNonce = "";
    let round = 0;
    let wrongLockUntil = 0;
    let freezeActive = false;

    const overlay = document.getElementById("portal-reverse-overlay");
    if (!overlay) return;

    function cleanNonce(nonce) {
        return (nonce.replace(/[^A-Za-z0-9]/g, "").toUpperCase() + "SOMBRA").slice(0, 6);
    }

    function captchaRound(nonce) {
        const a = (nonce.charCodeAt(0) % 8) + 3;
        const b = (nonce.charCodeAt(1) % 9) + 2;
        if (round === 0) {
            return { prompt: cleanNonce(nonce), answer: cleanNonce(nonce), label: "ROUND 1/3 · Enter the verification code" };
        }
        if (round === 1) {
            return { prompt: `${a} + ${b} = ?`, answer: String(a + b), label: "ROUND 2/3 · Solve the security check" };
        }
        return { prompt: "SOMBRA-BLUE-7", answer: "SOMBRA-BLUE-7", label: "ROUND 3/3 · Transcribe the final phrase" };
    }

    function renderCaptcha(nonce) {
        const ui = document.getElementById("portal-captcha-ui");
        const prompt = document.getElementById("portal-captcha-prompt");
        const roundLabel = document.getElementById("portal-captcha-round");
        const answer = document.getElementById("portal-captcha-answer");
        const challenge = captchaRound(nonce);
        ui.hidden = false;
        roundLabel.textContent = challenge.label;
        prompt.textContent = challenge.prompt;
        answer.value = "";
        answer.placeholder = round === 2 ? "Type the final phrase" : "Enter answer";
        answer.dataset.answer = challenge.answer;
    }

    document.getElementById("portal-captcha-submit").addEventListener("click", () => {
        if (Date.now() < wrongLockUntil) return;
        const answer = document.getElementById("portal-captcha-answer");
        if (answer.value.trim().toUpperCase() === answer.dataset.answer) {
            round += 1;
            if (round >= 3) {
                solvedNonce = activeNonce;
                overlay.hidden = true;
            } else {
                renderCaptcha(activeNonce);
            }
        } else {
            wrongLockUntil = Date.now() + 1500;
            answer.value = "";
            answer.placeholder = "Incorrect - 1.5 second delay";
            answer.parentElement.classList.remove("portal-reverse-shake");
            void answer.parentElement.offsetWidth;
            answer.parentElement.classList.add("portal-reverse-shake");
        }
    });

    async function poll() {
        try {
            const response = await fetch(stateUrl, { cache: "no-store", headers: { Accept: "application/json" } });
            if (!response.ok) return;
            const payload = await response.json();
            apply(payload.gamemaster || payload);
        } catch {
            // Leave normal portal behavior intact during temporary polling failures.
        }
    }

    function apply(state) {
        const effect = state.reverseEffect || "none";
        const until = Number(state.reverseUntil || 0);
        const nonce = state.reverseNonce || "";
        const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));

        document.body.classList.remove("reverse-scramble", "reverse-throttle", "reverse-blackout");
        overlay.hidden = true;
        overlay.style.display = "";
        document.body.style.overflow = "";

        const watch = document.getElementById("portal-watch-banner");
        const incident = document.getElementById("portal-incident-banner");
        const broadcast = document.getElementById("portal-broadcast-banner");
        const freeze = document.getElementById("portal-freeze-banner");
        if (watch) watch.hidden = !state.watchMode;
        if (incident) incident.hidden = !state.incidentMode;
        if (broadcast) {
            broadcast.textContent = state.banner || "";
            broadcast.hidden = !state.banner;
        }
        if (freeze) freeze.hidden = !state.freezeMode;
        freezeActive = Boolean(state.freezeMode);

        document.querySelectorAll("button, input[type='submit']").forEach((control) => {
            if (control.id === "portal-captcha-submit") return;
            if (state.freezeMode) control.setAttribute("aria-disabled", "true");
            else control.removeAttribute("aria-disabled");
        });

        if (effect === "none" || remaining === 0) return;

        if (activeNonce !== nonce) {
            activeNonce = nonce;
            round = 0;
            document.getElementById("portal-captcha-prompt").textContent = "";
            if (solvedNonce === nonce) solvedNonce = "";
        }

        const title = document.getElementById("portal-reverse-title");
        const copy = document.getElementById("portal-reverse-copy");
        const countdown = document.getElementById("portal-reverse-countdown");
        const ui = document.getElementById("portal-captcha-ui");
        countdown.textContent = `Countermeasure expires in ${remaining}s`;

        if (effect === "captcha") {
            ui.hidden = false;
            if (solvedNonce === nonce) return;
            title.textContent = "3-Step Portal Verification";
            copy.textContent = "Complete all rounds correctly. Wrong answers add a delay.";
            overlay.hidden = false;
            if (!ui.querySelector("#portal-captcha-prompt").textContent) renderCaptcha(nonce);
        } else if (effect === "scramble") {
            ui.hidden = true;
            document.body.classList.add("reverse-scramble");
        } else if (effect === "throttle") {
            ui.hidden = true;
            document.body.classList.add("reverse-throttle");
            title.textContent = "Portal Actions Throttled";
            copy.textContent = "Navigation and submissions are temporarily locked.";
            overlay.hidden = false;
        } else if (effect === "blackout") {
            ui.hidden = true;
            document.body.classList.add("reverse-blackout");
            document.body.style.overflow = "hidden";
            title.textContent = "Portal Temporarily Blacked Out";
            copy.textContent = "Blue Team has interrupted access to portal actions.";
            overlay.hidden = false;
            overlay.style.display = "grid";
            overlay.setAttribute("role", "dialog");
            overlay.setAttribute("aria-modal", "true");
        }
        if (effect !== "blackout") {
            document.body.style.overflow = "";
        }
    }

    document.addEventListener("submit", (event) => {
        if (document.body.classList.contains("reverse-throttle") ||
            document.body.classList.contains("reverse-blackout") ||
            freezeActive) {
            event.preventDefault();
        }
    }, true);

    document.addEventListener("click", (event) => {
        if (document.body.classList.contains("reverse-blackout")) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);

    poll();
    window.setInterval(poll, 3000);
})();
