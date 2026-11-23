const express = require("express");
const crypto = require("node:crypto");
const { verifyPassword } = require("../auth/passwords");
const {
    COOKIE_NAME,
    readPortalSession,
    requirePortalLogin,
} = require("../middleware/portal-auth");

const db = require("../db/portal_connection");
const ctfDb = require("../db/ctf_connection");

const router = express.Router();
const documentsRouter = require("./portal/documents-route").router;

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function audit(req, userId, eventType, target, details) {
    db.prepare(
        `
        INSERT INTO audit_events (actor_user_id, event_type, target, source_ip, details)
        VALUES (?, ?, ?, ?, ?)
    `,
    ).run(userId || null, eventType, target, req.ip || null, details || null);
}

function readCtfTeamId(req) {
    const teamCookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("ctf_team_id="));
    if (teamCookie) {
        const teamId = Number(teamCookie.slice("ctf_team_id=".length));
        if (Number.isInteger(teamId) && teamId > 0) return teamId;
    }

    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("ctf_session="));
    if (cookie) {
        const token = decodeURIComponent(cookie.slice("ctf_session=".length));
        if (token) {
            const tokenHash = crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");
            const participant = ctfDb
                .prepare(
                    `
                    SELECT p.team_id
                    FROM ctf_sessions s
                    JOIN ctf_players p ON p.id = s.player_id
                    WHERE s.token_hash = ? AND s.expires_at > ?
                `,
                )
                .get(tokenHash, Date.now());
            if (participant?.team_id) return participant.team_id;
        }
    }

    const portalSession = readPortalSession(req);
    if (!portalSession?.username) return null;

    const participant = ctfDb
        .prepare(
            `
            SELECT team_id
            FROM ctf_players
            WHERE username = ? AND active = 1
        `,
        )
        .get(portalSession.username);
    return participant?.team_id || null;
}

function getPortalReverseState(teamId) {
    if (!teamId)
        return { reverseEffect: "none", reverseUntil: 0, reverseNonce: "" };

    const rows = ctfDb
        .prepare("SELECT key, value FROM ctf_gamemaster_state")
        .all();
    const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const reverseUntil = Number(state.reverse_until || 0);
    const reverseTeamID = Number(state.reverse_team_id || 0);
    const reverseActive =
        teamId &&
        reverseTeamID === Number(teamId) &&
        reverseUntil > Date.now() &&
        ["captcha", "scramble", "throttle", "blackout"].includes(
            state.reverse_effect,
        );

    return reverseActive
        ? {
              reverseEffect: state.reverse_effect,
              reverseUntil: reverseUntil,
              reverseNonce: state.reverse_nonce || "",
          }
        : { reverseEffect: "none", reverseUntil: 0, reverseNonce: "" };
}

function getGamemasterState(teamId = null) {
    const rows = ctfDb
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

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.portalSession) return res.redirect("/login");
        if (!roles.includes(req.portalSession.role)) {
            return res.status(403).render("restricted", {
                requiredRole: roles.join(" or "),
                currentRole: req.portalSession.role,
            });
        }
        next();
    };
}

router.get("/portal/reverse-state", (req, res) => {
    res.json(getGamemasterState(readCtfTeamId(req)));
});

router.get("/portal/live-state", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ gamemaster: getGamemasterState(readCtfTeamId(req)) });
});

router.use((req, res, next) => {
    if (
        !req.path.startsWith("/ctf") &&
        !req.path.startsWith("/gamemaster") &&
        !req.path.startsWith("/portal") &&
        req.method !== "GET" &&
        req.method !== "HEAD"
    ) {
        const reverse = getPortalReverseState(readCtfTeamId(req));
        if (
            ["captcha", "throttle", "blackout"].includes(reverse.reverseEffect)
        ) {
            return res
                .status(423)
                .send(
                    "Portal actions are locked by an active Blue Team countermeasure.",
                );
        }
        const live = getGamemasterState(readCtfTeamId(req));
        if (live.freezeMode) {
            return res
                .status(423)
                .send("Portal submissions are frozen by the Game Master.");
        }
    }
    next();
});

function requireSecureRole(...roles) {
    return (req, res, next) => {
        const session = readSecurePortalSession(req);
        if (!session) return res.redirect("/login");

        if (!roles.includes(session.role)) {
            return res.status(403).render("restricted", {
                requiredRole: roles.join(" or "),
                currentRole: session.role,
            });
        }

        req.securePortalSession = session;
        next();
    };
}

router.get("/", (req, res) => res.render("public"));

router.get("/login", (req, res) => {
    if (readPortalSession(req)) return res.redirect("/employee");
    res.render("login", { error: req.query.error === "1" });
});

router.post("/login", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const user = db
        .prepare(
            `
        SELECT id, username, password_hash, role, active
        FROM users WHERE username = ?
    `,
        )
        .get(username);

    const valid =
        user &&
        user.active === 1 &&
        verifyPassword(password, user.password_hash);
    if (!valid) return res.redirect("/login?error=1");

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.prepare(
        `
        INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
    `,
    ).run(tokenHash, user.id, Date.now() + SESSION_TTL_MS, Date.now());

    audit(req, user.id, "login", "portal", "Employee logged in");
    const legacyRole = user.role === "admin" ? "admin" : "basic";
    const expiresAt = Date.now() + SESSION_TTL_MS;
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(
        expiresAt,
        tokenHash,
    );
    res.setHeader("Set-Cookie", [
        sessionCookie(
            { tokenHash, expiresAt },
            Math.floor(SESSION_TTL_MS / 1000),
        ),
        `${LEGACY_COOKIE_NAME}=user%3D${encodeURIComponent(user.username)}%26role%3D${legacyRole}; Path=/; SameSite=Lax`,
    ]);
    res.redirect("/employee");
});

router.post("/logout", requirePortalLogin, (req, res) => {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (cookie) {
        const encrypted = decodeURIComponent(
            cookie.slice(COOKIE_NAME.length + 1),
        );
        const payload = decryptSessionPayload(encrypted);
        if (payload?.tokenHash) {
            db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
                payload.tokenHash,
            );
        }
    }
    audit(
        req,
        req.portalSession.userId,
        "logout",
        "portal",
        "Employee logged out",
    );
    res.setHeader("Set-Cookie", [
        `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        `${LEGACY_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`,
    ]);
    res.redirect("/");
});

router.get("/employee", requirePortalLogin, (req, res) => {
    const departments = db
        .prepare("SELECT name, description FROM departments ORDER BY name")
        .all();
    const employeeCount = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1")
        .get().count;
    const currentUser = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(req.portalSession.username);
    const announcements = db
        .prepare(
            `
        SELECT title, body, category, created_at FROM announcements
        WHERE published = 1 ORDER BY created_at DESC LIMIT 5
    `,
        )
        .all();
    res.render("dashboard", {
        departments,
        employeeCount,
        role: req.portalSession.role,
        profileId: currentUser ? currentUser.id : null,
        announcements,
        canEdit: readSecurePortalSession(req)?.role === "editor",
    });
});

router.get("/employee/profile", requirePortalLogin, (req, res) => {
    const employeeId = Number.parseInt(req.query.id, 10);
    if (!Number.isInteger(employeeId))
        return res.status(400).send("Missing employee ID.");

    const employee = db
        .prepare(
            `
        SELECT users.id, users.employee_no, users.first_name, users.last_name,
               users.title, users.email, users.office, users.notes,
               departments.name AS department
        FROM users JOIN departments ON users.department_id = departments.id
        WHERE users.id = ? AND users.active = 1
    `,
        )
        .get(employeeId);
    if (!employee) return res.status(404).send("Employee not found.");
    res.render("profile", { employee, role: req.portalSession.role });
});

router.get(
    ["/directory", "/employee/directory"],
    requirePortalLogin,
    (req, res) => {
        const employees = db
            .prepare(
                `
        SELECT users.employee_no, users.first_name, users.last_name, users.title,
               users.email, departments.name AS department
        FROM users JOIN departments ON users.department_id = departments.id
        WHERE users.active = 1 ORDER BY users.last_name
    `,
            )
            .all();
        if (req.accepts(["html", "json"]) === "json")
            return res.json(employees);
        res.render("directory", { employees, role: req.portalSession.role });
    },
);

router.get(
    ["/departments", "/employee/departments"],
    requirePortalLogin,
    (req, res) => {
        const departments = db
            .prepare(
                `
        SELECT id, name, code, description,
               (SELECT COUNT(*) FROM users WHERE users.department_id = departments.id AND users.active = 1) AS employee_count
        FROM departments ORDER BY name
    `,
            )
            .all();
        if (req.accepts(["html", "json"]) === "json")
            return res.json(departments);
        res.render("departments", {
            departments,
            role: req.portalSession.role,
        });
    },
);

router.get(
    ["/employee/news", "/announcements", "/news"],
    requirePortalLogin,
    (req, res) => {
        const announcements = db
            .prepare(
                `
        SELECT announcements.*, users.first_name, users.last_name
        FROM announcements LEFT JOIN users ON users.id = announcements.author_id
        WHERE published = 1 ORDER BY created_at DESC
    `,
            )
            .all();
        if (req.accepts(["html", "json"]) === "json")
            return res.json(announcements);

        const secureSession = readSecurePortalSession(req);
        res.render("news", {
            announcements,
            role: req.portalSession.role,
            canEdit: secureSession?.role === "editor",
        });
    },
);

router.get("/employee/news/editor", requireSecureRole("editor"), (req, res) => {
    const announcements = db
        .prepare(
            `
                SELECT announcements.*, users.username AS author_username
                FROM announcements
                LEFT JOIN users ON users.id = announcements.author_id
                ORDER BY created_at DESC
            `,
        )
        .all();

    res.render("news-editor", {
        announcements,
        role: req.securePortalSession.role,
        username: req.securePortalSession.username,
    });
});

router.post(
    "/employee/news/editor",
    requireSecureRole("editor"),
    (req, res) => {
        const title = String(req.body.title || "")
            .trim()
            .slice(0, 160);
        const body = (
            String(req.body.body || "") +
            "\n\n<!-- SOMBRA{utilized_password_leak_8h9i0j1k} -->"
        )
            .trim()
            .slice(0, 4000);
        const category = String(req.body.category || "General")
            .trim()
            .slice(0, 80);
        const published = req.body.published === "1" ? 1 : 0;

        if (!title || !body) {
            return res.status(400).send("Title and body are required.");
        }

        db.prepare(
            `
            INSERT INTO announcements
                (title, body, category, author_id, published)
            VALUES (?, ?, ?, ?, ?)
        `,
        ).run(title, body, category, req.securePortalSession.userId, published);
        audit(
            req,
            req.securePortalSession.userId,
            "announcement_create",
            title,
            `Published: ${published === 1 ? "yes" : "no"}`,
        );
        res.redirect("/employee/news/editor");
    },
);

router.get(
    ["/employee/tickets", "/tickets"],
    requirePortalLogin,
    (req, res) => {
        const where =
            req.portalSession.role === "employee"
                ? "WHERE requester_id = ?"
                : "";
        const params =
            req.portalSession.role === "employee"
                ? [req.portalSession.userId]
                : [];
        const tickets = db
            .prepare(
                `
        SELECT support_tickets.*, requester.username AS requester,
               assignee.username AS assignee
        FROM support_tickets
        JOIN users requester ON requester.id = support_tickets.requester_id
        LEFT JOIN users assignee ON assignee.id = support_tickets.assigned_to
        ${where}
        ORDER BY support_tickets.created_at DESC
    `,
            )
            .all(...params);
        res.render("tickets", { tickets, role: req.portalSession.role });
    },
);

router.post("/employee/tickets", requirePortalLogin, (req, res) => {
    const subject = String(req.body.subject || "")
        .trim()
        .slice(0, 160);
    const description = String(req.body.description || "")
        .trim()
        .slice(0, 4000);
    const priority = ["low", "normal", "high", "urgent"].includes(
        req.body.priority,
    )
        ? req.body.priority
        : "normal";
    if (!subject || !description)
        return res.status(400).send("Subject and description are required.");

    const ticketNo = `ST-${Date.now().toString().slice(-8)}`;
    db.prepare(
        `
        INSERT INTO support_tickets (ticket_no, requester_id, subject, description, priority)
        VALUES (?, ?, ?, ?, ?)
    `,
    ).run(ticketNo, req.portalSession.userId, subject, description, priority);
    audit(req, req.portalSession.userId, "ticket_create", ticketNo, subject);
    res.redirect("/employee/tickets");
});

router.post(
    "/employee/tickets/:id/status",
    requirePortalLogin,
    requireRole("it", "admin"),
    (req, res) => {
        const id = Number(req.params.id);
        const status = ["open", "in_progress", "resolved", "closed"].includes(
            req.body.status,
        )
            ? req.body.status
            : null;
        if (!status) return res.status(400).send("Invalid ticket status.");
        db.prepare(
            "UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?",
        ).run(status, req.portalSession.userId, id);
        audit(
            req,
            req.portalSession.userId,
            "ticket_status",
            String(id),
            status,
        );
        res.redirect("/employee/tickets");
    },
);

router.get(
    "/employee/admin",
    requirePortalLogin,
    requireRole("admin", "it"),
    (req, res) => {
        const stats = {
            users: db
                .prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1")
                .get().count,
            documents: db
                .prepare("SELECT COUNT(*) AS count FROM documents")
                .get().count,
            tickets: db
                .prepare("SELECT COUNT(*) AS count FROM support_tickets")
                .get().count,
            openTickets: db
                .prepare(
                    "SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('open','in_progress')",
                )
                .get().count,
        };
        const auditEvents = db
            .prepare(
                `
        SELECT audit_events.*, users.username
        FROM audit_events LEFT JOIN users ON users.id = audit_events.actor_user_id
        ORDER BY occurred_at DESC LIMIT 100
    `,
            )
            .all();
        res.render("admin", {
            role: req.portalSession.role,
            stats,
            auditEvents,
        });
    },
);

router.get(
    ["/employee/audit", "/audit"],
    requirePortalLogin,
    requireRole("admin", "it"),
    (req, res) => {
        const auditEvents = db
            .prepare(
                `
        SELECT audit_events.*, users.username
        FROM audit_events LEFT JOIN users ON users.id = audit_events.actor_user_id
        ORDER BY occurred_at DESC LIMIT 200
    `,
            )
            .all();
        res.render("audit", { auditEvents, role: req.portalSession.role });
    },
);

router.get("/lol", (req, res) =>
    res.send(
        "<!DOCTYPE html><html><body>Login attempt not recognized.</body></html>",
    ),
);

// CTF password-hash exercise. Intentionally public and intentionally weak.
router.get("/api/passwords", (req, res) => {
    res.json([
        { username: "avery.patel", hash: "5f4dcc3b5aa765d61d8327deb882cf99" },
        { username: "amanda.smith", hash: "e99a18c428cb38d5f260853678922e03" },
        { username: "james.wilson", hash: "202cb962ac59075b964b07152d234b70" },
        { username: "linda.johnson", hash: "098f6bcd4621d373cade4e832627b4f6" },
        {
            username: "robert.brown",
            hash: "SOMBRA{how_did_you_find_this_endpoint_3x4y5z6a}",
        },
    ]);
});

router.get("/api/secret", (req, res) => {
    res.json({
        flag: "SOMBRA{how_did_you_find_this_endpoint_3x4y5z6a}",
    });
});

router.use("/", documentsRouter);

module.exports = router;
