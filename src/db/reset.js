const fs = require("node:fs");
// const path = require("node:path");

// const db = require("./connection");

// delete entire /data folder
const dataDir = "./data";
if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    console.log(`Deleted ${dataDir} folder.`);
} else {
    console.log(`${dataDir} folder does not exist.`);
}

// recreate /data folder
fs.mkdirSync(dataDir, { recursive: true });
console.log(`Recreated ${dataDir} folder.`);

// // recreate database file
// const dbPath = path.join(dataDir, "ctf.sqlite");
// db.prepare("VACUUM;").run();
// console.log(`Recreated database file at ${dbPath}.`);
