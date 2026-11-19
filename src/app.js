const express = require("express");
const helmet = require("helmet");
const path = require("node:path");
const ctfRoutes = require("./routes/ctf");

const app = express();

// Hide Express identification.
app.disable("x-powered-by");

// Configure EJS.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Security headers.
app.use(helmet());

// Parse incoming form data.
app.use(
    express.urlencoded({
        extended: false,
        limit: "10kb",
    }),
);

// Serve CSS, JavaScript, and images.
app.use(express.static(path.join(__dirname, "../public")));

// Main application routes.
app.use("/", require("./routes/portal"));

// Challenge routes.
app.use("/", require("./routes/challenges"));

app.use("/", ctfRoutes);
app.use("/", require("./routes/gamemaster"));

// 404 handler.
app.use((req, res) => {
    res.status(404).send("Page not found.");
});

// Error handler.
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).send("An internal server error occurred.");
});

module.exports = app;
