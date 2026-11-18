const crypto = require("node:crypto");
const challenges = require("../challenges/registry");

module.exports = function seedCtf(db) {
    const insertChallenge = db.prepare(`
        INSERT INTO ctf_challenges (
            id,
            title,
            category,
            difficulty,
            points,
            flag_hash,
            active
        )
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            category = excluded.category,
            difficulty = excluded.difficulty,
            points = excluded.points,
            flag_hash = excluded.flag_hash,
            active = 1
    `);

    const seedTransaction = db.transaction(() => {
        for (const challenge of challenges) {
            const flagHash = crypto
                .createHash("sha256")
                .update(challenge.flag)
                .digest("hex");

            insertChallenge.run(
                challenge.id,
                challenge.name,
                challenge.category,
                challenge.difficulty || "Beginner",
                challenge.points,
                flagHash,
            );
        }
    });

    seedTransaction();

    console.log(`Registered ${challenges.length} CTF challenges.`);
};
