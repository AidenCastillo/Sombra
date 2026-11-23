const { hashPassword } = require("../auth/passwords");

const seedPasswords = {
    "morgan.lee": "Sombra2026!",
    "jordan.reyes": "Sombra2026!",
    "avery.patel": "Sombra2026!",
    "casey.nguyen": "Sombra2026!",
    "riley.brooks": "Sombra2026!",
    "dana.whitfield": "Sombra2026!",
    "sam.okafor": "Sombra2026!",
    "amanda.smith": "amandaLOVESdogs",
};

function ensurePortalRecords(db) {
    const remoteAccessGuide = db
        .prepare("SELECT id FROM documents WHERE title = ?")
        .get("Remote Access Guide");
    if (remoteAccessGuide) {
        db.prepare("UPDATE documents SET body = ? WHERE id = ?").run(
            `<h2>Approved Remote Access</h2>
<p>Employees must use the company-managed VPN and approved multi-factor authentication from a trusted device.</p>
<h2>Before Connecting</h2>
<ul>
  <li>Install operating-system security updates.</li>
  <li>Verify that endpoint protection is active and current.</li>
  <li>Do not connect from public or shared computers.</li>
</ul>
<h2>Connecting</h2>
<ol>
  <li>Open the approved Sombra VPN client.</li>
  <li>Sign in with your employee account.</li>
  <li>Approve the sign-in prompt in your MFA application.</li>
</ol>
<p>For connection problems, contact IT and include the time of the failure and your device name. Do not include passwords or MFA codes in support requests.</p>`,
            remoteAccessGuide.id,
        );
    }

    if (
        db.prepare("SELECT COUNT(*) AS count FROM announcements").get()
            .count === 0
    ) {
        db.prepare(
            `
                INSERT INTO announcements (title, body, category, author_id)
                VALUES (?, ?, ?, ?)
            `,
        ).run(
            "Corporate Infrastructure Modernization",
            "Phase II of the infrastructure modernization initiative is now active.",
            "Company",
            1,
        );
    }

    if (
        db.prepare("SELECT COUNT(*) AS count FROM support_tickets").get()
            .count === 0
    ) {
        db.prepare(
            `
                INSERT INTO support_tickets (ticket_no, requester_id, assigned_to, subject, description, status, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
        ).run(
            "ST-1001",
            3,
            2,
            "VPN access issue",
            "Unable to connect to the corporate VPN from the San Antonio office.",
            "open",
            "normal",
        );
    }

    if (
        db.prepare("SELECT COUNT(*) AS count FROM audit_events").get().count ===
        0
    ) {
        db.prepare(
            `
                INSERT INTO audit_events (actor_user_id, event_type, target, details)
                VALUES (?, ?, ?, ?)
            `,
        ).run(1, "seed", "portal", "Initial corporate portal data loaded");
    }
}

function updateSeedPasswords(db) {
    const update = db.prepare(
        "UPDATE users SET password_hash = ? WHERE username = ?",
    );
    for (const [username, password] of Object.entries(seedPasswords)) {
        const user = db
            .prepare("SELECT password_hash FROM users WHERE username = ?")
            .get(username);
        if (
            user &&
            (user.password_hash === "NOT_YET_CONFIGURED" ||
                !user.password_hash.startsWith("$2"))
        ) {
            update.run(hashPassword(password), username);
        }
    }
    db.exec("PRAGMA ignore_check_constraints = ON");
    db.prepare(
        "UPDATE users SET role = 'editor' WHERE username = 'amanda.smith'",
    ).run();
    db.exec("PRAGMA ignore_check_constraints = OFF");
}

function seed(db) {
    const departmentCount = db
        .prepare("SELECT COUNT(*) AS count FROM departments")
        .get().count;

    if (departmentCount > 0) {
        updateSeedPasswords(db);
        ensurePortalRecords(db);
        return;
    }

    const insertDepartment = db.prepare(`
        INSERT INTO departments (name, code, description)
        VALUES (?, ?, ?)
    `);

    const departments = [
        ["Executive Office", "EXEC", "Corporate leadership"],
        ["Information Technology", "IT", "Infrastructure and IT support"],
        ["People Operations", "HR", "Employee services"],
        ["Finance", "FIN", "Financial operations"],
        ["Engineering", "ENG", "Software and product engineering"],
    ];

    for (const department of departments) {
        insertDepartment.run(...department);
    }

    const insertUser = db.prepare(`
    INSERT INTO users (
        employee_no, username, password_hash, first_name, last_name,
        email, title, department_id, role, office, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const placeholderHash = "NOT_YET_CONFIGURED";

    const users = [
        [
            "BT-0017",
            "morgan.lee",
            placeholderHash,
            "Morgan",
            "Lee",
            "morgan.lee@sombra.example",
            "Chief Operating Officer",
            1,
            "admin",
            "Austin HQ",
            "Board access recovery phrase stored with Legal. SOMBRA{profile_ids_arent_access_control_9dm#bcu*}",
        ],
        [
            "BT-0042",
            "jordan.reyes",
            placeholderHash,
            "Jordan",
            "Reyes",
            "jordan.reyes@sombra.example",
            "IT Systems Analyst",
            2,
            "it",
            "Austin HQ",
            "TODO: stop storing role and username in the session cookie before launch.",
        ],
        [
            "BT-0088",
            "avery.patel",
            placeholderHash,
            "Avery",
            "Patel",
            "avery.patel@sombra.example",
            "People Operations Partner",
            3,
            "employee",
            "San Antonio",
            "Onboarding lead for Q1 hires. Remind new hires to review the Acceptable Use Policy.",
        ],
        [
            "BT-0103",
            "casey.nguyen",
            placeholderHash,
            "Casey",
            "Nguyen",
            "casey.nguyen@sombra.example",
            "Financial Analyst",
            4,
            "employee",
            "Austin HQ",
            "Quarterly budget review due Friday. Vendor invoices are filed under Finance.",
        ],
        [
            "BT-0126",
            "riley.brooks",
            placeholderHash,
            "Riley",
            "Brooks",
            "riley.brooks@sombra.example",
            "Software Engineer",
            5,
            "employee",
            "Remote",
            "Working remotely. Document intake service still needs hardening.",
        ],
        [
            "BT-0131",
            "dana.whitfield",
            placeholderHash,
            "Dana",
            "Whitfield",
            "dana.whitfield@sombra.example",
            "Security Analyst",
            2,
            "it",
            "Austin HQ",
            "Reviewing the document upload service. Do not expose externally.",
        ],
        [
            "BT-0144",
            "sam.okafor",
            placeholderHash,
            "Sam",
            "Okafor",
            "sam.okafor@sombra.example",
            "Executive Assistant",
            1,
            "employee",
            "Austin HQ",
            "Manages Morgan's calendar. Ask IT for admin portal access requests.",
        ],
        [
            "BT-0150",
            "amanda.smith",
            placeholderHash,
            "Amanda",
            "Smith",
            "amanda.smith@sombra.example",
            "Operations Manager",
            1,
            "it",
            "Austin HQ",
            "...",
        ],
    ];

    for (const user of users) {
        insertUser.run(...user);
    }

    updateSeedPasswords(db);

    const insertDocument = db.prepare(`
        INSERT INTO documents (
            title, category, summary, body, owner_id
        )
        VALUES (?, ?, ?, ?, ?)
    `);

    const documents = [
        [
            "Acceptable Use Policy",
            "Policies",
            "Guidelines for using company systems.",
            "Employees must protect company information and report suspicious activity to IT.",
            2,
        ],
        [
            "Remote Access Guide",
            "IT Guides",
            "Approved remote access methods.",
            `<h2>Approved Remote Access</h2>
<p>We are still working on getting a fully secure remote access solution in place.</p>
<p>For now, you can just use a telnet connection to access the system remotely.</p>
<h2>Troubleshooting</h2>
<ul>
  <li>Check your network connection.</li>
  <li>Verify that the required ports are open. We use 2323</li>
  <li>Ensure your firewall allows outbound connections.</li>
</ul>
<p>For connection problems, contact IT and include the time of the failure and your device name. Do not include passwords or MFA codes in support requests.</p>`,
            2,
        ],
        [
            "Employee Onboarding",
            "HR",
            "New employee onboarding instructions.",
            "New employees should complete identity verification and equipment enrollment.",
            3,
        ],
    ];

    for (const document of documents) {
        insertDocument.run(...document);
    }

    const announcementCount = db
        .prepare("SELECT COUNT(*) AS count FROM announcements")
        .get().count;
    if (announcementCount === 0) {
        const insertAnnouncement = db.prepare(`
            INSERT INTO announcements (title, body, category, author_id)
            VALUES (?, ?, ?, ?)
        `);
        insertAnnouncement.run(
            "Corporate Infrastructure Modernization",
            "Phase II of the infrastructure modernization initiative is now active.",
            "Company",
            1,
        );
        insertAnnouncement.run(
            "Quarterly Security Reminder",
            "Employees should use strong, unique passwords and report suspicious activity to IT.",
            "Security",
            6,
        );
    }

    const ticketCount = db
        .prepare("SELECT COUNT(*) AS count FROM support_tickets")
        .get().count;
    if (ticketCount === 0) {
        const insertTicket = db.prepare(
            `
            INSERT INTO support_tickets (
                ticket_no, requester_id, assigned_to, subject, description, status, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        );
        insertTicket.run(
            "ST-1001",
            3,
            2,
            "VPN access issue",
            "Unable to connect to the corporate VPN from the San Antonio office.",
            "open",
            "normal",
        );

        insertTicket.run(
            "ST-1002",
            4,
            2,
            "Email server outage",
            "Corporate email server is currently down.",
            "open",
            "high",
        );

        insertTicket.run(
            "ST-1003",
            5,
            2,
            "Printer malfunction",
            "The printer on the 3rd floor is not functioning correctly.",
            "open",
            "normal",
        );

        insertTicket.run(
            "ST-1004",
            6,
            2,
            "Network connectivity issue",
            "Users in the San Antonio office are experiencing intermittent network connectivity problems.",
            "open",
            "normal",
        );
        insertTicket.run(
            "ST-1005",
            7,
            2,
            "Server maintenance",
            "Scheduled maintenance for the corporate servers this weekend.",
            "open",
            "normal",
        );
        insertTicket.run(
            "ST-1006",
            8,
            2,
            "Sombra flag",
            "SOMBRA{it_i_need_help_adnu819z}",
            "closed",
            "normal",
        );
    }

    const auditCount = db
        .prepare("SELECT COUNT(*) AS count FROM audit_events")
        .get().count;
    if (auditCount === 0) {
        db.prepare(
            `
            INSERT INTO audit_events (actor_user_id, event_type, target, details)
            VALUES (?, ?, ?, ?)
        `,
        ).run(1, "seed", "portal", "Initial corporate portal data loaded");
    }

    console.log("Sombra Technologies seed data inserted.");
}

module.exports = seed;
