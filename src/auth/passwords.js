const crypto = require("node:crypto");

let bcrypt = null;
try {
    bcrypt = require("bcryptjs");
} catch {}

function hashPassword(password) {
    if (bcrypt) return bcrypt.hashSync(password, 12);

    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, passwordHash) {
    if (!passwordHash) return false;

    if (passwordHash.startsWith("$2")) {
        if (!bcrypt) return false;
        return bcrypt.compareSync(password, passwordHash);
    }

    if (passwordHash.startsWith("scrypt$")) {
        const [, salt, expected] = passwordHash.split("$");
        if (!salt || !expected) return false;
        const actual = crypto.scryptSync(password, salt, 64);
        const expectedBuffer = Buffer.from(expected, "hex");
        return expectedBuffer.length === actual.length &&
            crypto.timingSafeEqual(expectedBuffer, actual);
    }

    return false;
}

module.exports = { hashPassword, verifyPassword };
