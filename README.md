# Sombra Technologies — Cybersecurity Training Lab

A simulated corporate environment and Capture the Flag (CTF) platform designed for hands-on cybersecurity training.

Sombra provides a fictional corporate employee portal containing intentionally vulnerable training scenarios, alongside a separate CTF system for flag submissions, team scoring, and leaderboards.

## 1. Technology Stack

| Component        | Technology                      |
| ---------------- | ------------------------------- |
| Backend          | Node.js + Express               |
| Database         | SQLite + better-sqlite3         |
| Frontend         | HTML, CSS, JavaScript           |
| Templates        | EJS                             |
| Testing          | Node.js test runner + Supertest |
| Containerization | Docker + Docker Compose         |

## 2. Project Structure

```text
Sombra/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── db/
│   │   ├── connection.js
│   │   ├── schema.sql
│   │   ├── seed.js
│   │   └── init.js
│   ├── routes/
│   │   ├── portal.js
│   │   ├── challenges.js
│   │   └── ctf.js
│   ├── challenges/
│   │   └── registry.js
│   └── views/
│       ├── dashboard.ejs
│       ├── backup-index.ejs
│       ├── it-archive-2024.ejs
│       └── ctf.ejs
├── public/
│   ├── css/
│   └── js/
├── data/
├── tests/
├── Dockerfile
├── compose.yaml
├── package.json
├── package-lock.json
├── .env
├── .gitignore
└── README.md
```

## 3. Initial Setup

### Requirements

Install:

- Node.js (preferably Node 22 or a compatible version)
- npm
- Git
- Docker Desktop or Docker Engine (optional)

### Install dependencies

From the project root:

```bash
npm install
```

If dependencies have not yet been installed:

```bash
npm install express better-sqlite3 ejs dotenv helmet
npm install --save-dev supertest
```

### Configure environment variables

Create or update `.env`:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DB_PATH=./data/sombra.sqlite
SESSION_SECRET=replace-this-with-a-long-random-secret
```

Do not commit `.env` to Git.

### Initialize the database

```bash
npm run init-db
```

This should create the SQLite database, apply the schema, and insert initial seed data.

## 4. Common Development Commands

### Start the application

```bash
npm start
```

### Start in development mode

```bash
npm run dev
```

Uses Node's watch mode to restart the application when files change.

### Run tests

```bash
npm test
```

### Initialize the database

```bash
npm run init-db
```

### Install a new dependency

```bash
npm install package-name
```

### Install a development dependency

```bash
npm install --save-dev package-name
```

### Check installed dependencies

```bash
npm list --depth=0
```

### Access the application

| Page               | URL                                               |
| ------------------ | ------------------------------------------------- |
| Corporate Portal   | http://localhost:3000/                            |
| Employee Directory | http://localhost:3000/directory                   |
| Robots File        | http://localhost:3000/robots.txt                  |
| Backup Directory   | http://localhost:3000/backup/                     |
| Archived IT Report | http://localhost:3000/backup/it-archive-2024.html |
| CTF Portal         | http://localhost:3000/ctf                         |

## 6. Public portal and training login

Open `http://localhost:3000/` for the public Sombra website.
Select **Employee login** to sign in with:

```text
Username: avery.patel
Password: Sombra2026!
```

The employee portal is available at `/employee`. It includes server-side
sessions as the main Phase 1 implementation, plus intentionally legacy CTF
session behavior:

```text
sombra_session=user=avery.patel&role=basic
```

For the Cookie Manipulation challenge, change `role=basic` to `role=admin` and
visit `/employee/admin`. The admin page contains the challenge flag.
The profile challenge remains available through `/employee/profile?id=...`;
the weak password-hash API is available at `/api/passwords`.

## 5. Database Management

Sombra currently uses SQLite.

The default database location is:

```text
data/sombra.sqlite
```

SQLite automatically creates additional files when using Write-Ahead Logging:

```text
sombra.sqlite
sombra.sqlite-shm
sombra.sqlite-wal
```

Do not manually delete these files while the application is running.

### Reset the database

**Warning: This permanently deletes all teams, challenge solves, submissions, and other database records.**

Stop the application first.

For Windows PowerShell:

```powershell
Remove-Item .\data\sombra.sqlite* -Force -ErrorAction SilentlyContinue
npm run init-db
```

For Linux/macOS:

```bash
rm -f data/sombra.sqlite*
npm run init-db
```

Then restart:

```bash
npm run dev
```

### What gets reset?

| Data                        | Reset behavior           |
| --------------------------- | ------------------------ |
| Teams                       | Deleted                  |
| Flag submissions            | Deleted                  |
| Challenge solves            | Deleted                  |
| Leaderboard                 | Cleared                  |
| Employee records            | Recreated from seed data |
| Documents                   | Recreated from seed data |
| Challenge flags in registry | Unchanged                |
| Source code                 | Unchanged                |

**Important:** The seed script must actually recreate every record you expect after a reset. Verify its current contents when adding new tables or data.

### Reset only CTF progress

If you want to reset team scores without deleting the corporate portal data, execute:

```sql
DELETE FROM ctf_attempts;
DELETE FROM ctf_solves;
DELETE FROM ctf_teams;
```

You can execute this using a SQLite client or a small Node.js script while the application is stopped.

## 6. Docker Commands

Docker is intended for packaging and deploying Sombra consistently.

### Build the image

```bash
docker compose build
```

### Build without using cached layers

```bash
docker compose build --no-cache
```

### Start the application

```bash
docker compose up -d
```

### Build and start together

```bash
docker compose up -d --build
```

### View running containers

```bash
docker compose ps
```

### View application logs

```bash
docker compose logs
```

Follow logs continuously:

```bash
docker compose logs -f
```

### Stop the application

```bash
docker compose down
```

### Restart the application

```bash
docker compose restart
```

### Stop and delete persistent Docker volumes

**Warning: This deletes the Docker-managed database volume and all stored CTF data.**

```bash
docker compose down -v
```

Then rebuild and start:

```bash
docker compose up -d --build
```

### Enter the running container

```bash
docker compose exec blackout-lab sh
```

If you rename the Compose service, replace `blackout-lab` with the new service name.

### Check Docker resource usage

```bash
docker stats
```

## 7. Git Commands

### Check changed files

```bash
git status
```

### Stage changes

```bash
git add .
```

### Commit changes

```bash
git commit -m "Describe your changes"
```

### Push changes

```bash
git push
```

### Pull updates

```bash
git pull
```

### Create a development branch

```bash
git checkout -b feature-name
```

### Return to main

```bash
git checkout main
```

Do not commit:

- `.env`
- `node_modules/`
- SQLite database files
- Real credentials or secrets
- Student information

## 8. Troubleshooting

### Database table does not exist

If you added a table to `schema.sql`, restart the server if it automatically applies the schema at startup, or run:

```bash
npm run init-db
```

If an existing database is not being updated as expected, check whether the schema uses `CREATE TABLE IF NOT EXISTS` and whether the database path is correct.

### Port already in use

Change the port in `.env`:

```env
PORT=3001
```

Then restart the application.

### Docker changes are not appearing

Rebuild the image:

```bash
docker compose down
docker compose up -d --build
```

### Check which database is being used

Verify:

```env
DB_PATH=./data/sombra.sqlite
```

Remember that the Docker container uses a different database path:

```text
/app/data/sombra.sqlite
```

The local database and Docker volume are not necessarily the same database.

---

# 9. Development Roadmap

The following is the recommended order for expanding Sombra.

## Phase 1 — Complete the Corporate Portal

- [x] Employee login and logout
- [x] Secure password hashing with bcrypt or Argon2
- [x] Server-side session management
- [x] Employee profiles
- [x] Department directory
- [x] Internal document viewer
- [x] Support ticket system
- [x] Announcements
- [x] User roles and permissions
- [x] Admin dashboard
- [x] Audit log viewer

## Phase 2 — Expand the CTF Platform

- [x] Proper team registration
- [x] Password-protected team accounts
- [ ] Team member management
- [ ] Instructor accounts
- [ ] Instructor dashboard
- [ ] Challenge creation and editing
- [ ] Challenge categories and difficulty levels
- [ ] Challenge attachments
- [ ] Hint penalties
- [ ] Challenge time tracking
- [ ] Submission rate limiting
- [ ] Event start and end times
- [ ] Scoreboard freeze
- [ ] Team progress history
- [ ] Challenge statistics

## Phase 3 — Build the Challenge Collection

The initial challenge should be the beginning of a larger simulated breach.

| Challenge             | Category       | Main Concept            |
| --------------------- | -------------- | ----------------------- |
| Forgotten Backup      | Reconnaissance | Information disclosure  |
| Weakest Link          | Authentication | Weak password security  |
| Employee Records      | Authorization  | IDOR / BOLA             |
| Support Ticket        | Web Security   | Stored XSS              |
| Administrative Access | Authorization  | Broken access control   |
| Final Report          | Investigation  | Incident reconstruction |

Additional challenges worth considering:

- Exposed configuration files
- Insecure direct object references
- Session management weaknesses
- SQL injection in an isolated training endpoint
- File upload validation weaknesses
- Insecure API endpoints
- Misconfigured access controls
- Log analysis and incident response
- Network traffic analysis
- Password hash identification
- Firmware and binary analysis
- Linux privilege and permission misconfigurations in isolated VMs

## Phase 4 — Make Challenges More Realistic

- [ ] Synthetic employee records
- [ ] Realistic IT documentation
- [ ] Historical audit logs
- [ ] Simulated employee emails
- [ ] Network diagrams
- [ ] PCAP downloads
- [ ] Configuration file downloads
- [ ] Simulated breach timeline
- [ ] Evidence collection system
- [ ] Cross-challenge clues
- [ ] Multiple possible investigation paths

The goal is to make students feel like they are investigating an actual corporate incident rather than completing disconnected CTF exercises.

## Phase 5 — Instructor and Event Management

- [ ] Instructor dashboard
- [ ] Create and manage events
- [ ] Register teams
- [ ] Assign challenges
- [ ] Monitor live submissions
- [ ] View team progress
- [ ] Reset individual teams
- [ ] Reset entire events
- [ ] Export scores to CSV
- [ ] Generate event reports
- [ ] Display live leaderboard
- [ ] Add announcements and event notifications

## Phase 6 — Infrastructure and Deployment

- [ ] Finalize Docker deployment
- [ ] Test target hardware architecture compatibility
- [ ] Configure isolated lab network
- [ ] Restrict access to the training environment
- [ ] Configure backups
- [ ] Add database recovery procedures
- [ ] Add health-check endpoint
- [ ] Add application monitoring
- [ ] Add structured logging
- [ ] Add deployment documentation
- [ ] Test concurrent student usage
- [ ] Test recovery after power loss

---

# 10. Important Security Considerations

Sombra intentionally contains vulnerable training endpoints. The CTF infrastructure itself should remain secure.

Keep the following separation:

| Component             | Security approach                                    |
| --------------------- | ---------------------------------------------------- |
| Corporate portal      | Intentionally vulnerable where challenges require it |
| CTF flag validation   | Server-side only                                     |
| Team accounts         | Secure authentication                                |
| Instructor accounts   | Role-based authorization                             |
| Database              | Parameterized SQL                                    |
| Session management    | Secure server-side sessions                          |
| Challenge attachments | Controlled storage and download                      |
| Host system           | Isolated from student-accessible vulnerabilities     |

Additional requirements before a real event:

1. Never expose the training network to the public internet.
2. Do not store real employee or student credentials in challenge data.
3. Do not allow vulnerable challenges to execute arbitrary commands on the host.
4. Keep scoring and instructor controls inaccessible to ordinary participants.
5. Back up the database before each event.
6. Test every challenge from a student account before deployment.

**Important current limitation:** The initial CTF implementation identifies teams by a submitted team name rather than authenticated accounts. Anyone who knows another team's name could submit flags for it. Do not use this implementation for a competitive event until team authentication and authorization are implemented.

---

# 11. Current Project Status

Sombra currently has the foundation for:

- Express application
- SQLite database
- Seed data
- Corporate portal
- Employee directory
- Exposed backup challenge
- Archived IT report
- CTF challenge registry
- Flag submission
- Automatic scoring
- Team leaderboard
- Docker configuration

The next recommended milestone is completing the authentication system and instructor dashboard before expanding the challenge collection.

**Long-term objective:** Build a self-contained cybersecurity training environment where students investigate a realistic fictional corporate breach, collect evidence, exploit safely simulated vulnerabilities, and reconstruct what happened.
