require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fileUpload = require("express-fileupload");
const multer = require("multer");


// Configurare server
const app = express();
const PORT = process.env.PORT || 3000;

// Configurare baza de date SQLite
const db = new sqlite3.Database(path.join(__dirname, "amc-logistics.db"), (err) => {
    if (err) {
        console.error("Error connecting to SQLite database:", err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

// Creare tabele
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'courier'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            auto TEXT NOT NULL,
            tour INTEGER NOT NULL,
            kunde INTEGER NOT NULL,
            start TEXT NOT NULL,
            ende TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users (id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS learning_resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            path TEXT NOT NULL
        )
    `);
});

// Middleware pentru upload
app.use(fileUpload());

// Endpoint pentru upload resurse
app.post("/upload-resource", (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send("No files were uploaded.");
    }

    const file = req.files.file;
    const uploadPath = path.join(__dirname, "uploads", file.name);

    // Salvează fișierul
    file.mv(uploadPath, (err) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.send("File uploaded!");
    });
});

// Configurare upload fișiere
const upload = multer({ dest: "uploads/" });

// Servirea fișierelor statice
app.use(express.static(path.join(__dirname, "public")));

// Rute statice pentru pagini HTML
app.get("/", (req, res) => res.redirect("/login"));

const staticPages = ["login", "dashboard", "admin-create-user", "info", "introducere-ruta", "istoric-rute", "mediu-invatare", "plan", "profile", "schimba-parola"];
staticPages.forEach((page) => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, "public", `${page}.html`));
    });
});

// Rute backend
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Invalid credentials" });

        if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.json({ token, userId: user.id, role: user.role });
    });
});

// Upload resurse
app.post("/upload-resource", upload.single("file"), (req, res) => {
    const { title, type } = req.body;
    const filePath = req.file.path;

    db.run("INSERT INTO learning_resources (title, type, path) VALUES (?, ?, ?)", [title, type, filePath], (err) => {
        if (err) return res.status(500).json({ error: "Error saving resource" });
        res.json({ success: true });
    });
});

// Pornire server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
