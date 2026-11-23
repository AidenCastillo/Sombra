const crypto = require("node:crypto");
const db = require("../db/portal_connection");
const LEGACY_COOKIE_NAME = "sombra_session";
const COOKIE_NAME = "portal_session";
const SESSION_SECRET =
    process.env.SESSION_SECRET || "development-session-secret";
const SESSION_KEY = crypto.createHash("sha256").update(SESSION_SECRET).digest();

function encryptSessionPayload(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", SESSION_KEY, iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSessionPayload(token) {
    try {
        const [ivText, tagText, encryptedText] = String(token).split(".");
        if (!ivText || !tagText || !encryptedText) return null;

        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            SESSION_KEY,
            Buffer.from(ivText, "base64url"),
        );
        decipher.setAuthTag(Buffer.from(tagText, "base64url"));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedText, "base64url")),
            decipher.final(),
        ]);
        return JSON.parse(decrypted.toString("utf8"));
    } catch {
        return null;
    }
}

function sessionCookie(payload, maxAge) {
    const encrypted = encryptSessionPayload(payload);
    const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
    return `${COOKIE_NAME}=${encodeURIComponent(encrypted)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}

function readSecurePortalSession(req) {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return null;

    const encrypted = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
    const payload = decryptSessionPayload(encrypted);
    if (
        !payload ||
        !payload.tokenHash ||
        !Number.isInteger(payload.expiresAt) ||
        payload.expiresAt <= Date.now()
    ) {
        return null;
    }

    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());

    const session = db
        .prepare(
            `
            SELECT sessions.user_id, users.username, users.role,
                   users.first_name, users.last_name
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND users.active = 1
              AND sessions.expires_at > ?
        `,
        )
        .get(payload.tokenHash, Date.now());
    if (!session) return null;

    return {
        userId: session.user_id,
        username: session.username,
        role: session.role,
        name: `${session.first_name} ${session.last_name}`,
    };
}

function requireSecurePortalLogin(req, res, next) {
    const session = readSecurePortalSession(req);
    if (!session) return res.redirect("/login");
    req.securePortalSession = session;
    next();
}

function readPortalSession(req) {
    const legacyCookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${LEGACY_COOKIE_NAME}=`));
    if (legacyCookie) {
        const legacyValue = decodeURIComponent(
            legacyCookie.slice(LEGACY_COOKIE_NAME.length + 1),
        );
        const roleMatch = legacyValue.match(
            /(?:^|[;,&])role[:=](basic|employee|it|admin)(?:[;,&]|$)/,
        );
        const userMatch = legacyValue.match(
            /(?:^|[;,&])user[:=]([a-zA-Z0-9._-]+)(?:[;,&]|$)/,
        );
        const username = userMatch ? userMatch[1] : null;
        const user = username
            ? db
                  .prepare(
                      "SELECT id, username, role, first_name, last_name FROM users WHERE username = ? AND active = 1",
                  )
                  .get(username)
            : null;

        if (user) {
            const legacyRole = roleMatch ? roleMatch[1] : "basic";
            return {
                userId: user.id,
                username: user.username,
                role: legacyRole === "basic" ? "employee" : legacyRole,
                name: `${user.first_name} ${user.last_name}`,
            };
        }
    }

    const cookie = (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return null;

    const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
    if (!token) return null;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());

    const session = db
        .prepare(
            `
        SELECT sessions.user_id, users.username, users.role, users.first_name, users.last_name
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND users.active = 1
    `,
        )
        .get(tokenHash);

    if (!session) return null;
    return {
        userId: session.user_id,
        username: session.username,
        role: session.role,
        name: `${session.first_name} ${session.last_name}`,
    };
}
function requirePortalLogin(req, res, next) {
    const session = readPortalSession(req);
    if (!session) return res.redirect("/login");
    req.portalSession = session;
    next();
}

module.exports = {
    COOKIE_NAME,
    readPortalSession,
    requirePortalLogin,
    readSecurePortalSession,
    requireSecurePortalLogin,
};
