// ================= IMPORTS =================
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { AircraftProvider, ProviderError } = require("./services/aircraftProvider");

// ================= APP SETUP =================
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5500,http://127.0.0.1:5500")
  .split(",").map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  }
}));
app.use(express.json());
app.use(express.static("public"));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
}


// ================= DATABASE =================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

db.connect(err => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL!");
});

const PORT = process.env.PORT || 3000;
const aircraftProvider = new AircraftProvider();

// ================= AUTH MIDDLEWARE =================
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header) return res.status(401).json({ message: "No token" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ message: "Invalid token" });
  }
}

// ================= AUTH ROUTES =================

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).send("Server error");

    if (results.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.pswrd);

    if (!match) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token });
  });
});

// SIGNUP
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).send("Server error");

    if (results.length > 0) {
      return res.status(400).send("Username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, pswrd) VALUES (?, ?)",
      [username, hashedPassword],
      err => {
        if (err) return res.status(500).send("Signup error");
        res.send({ message: "User created" });
      }
    );
  });
});

// CURRENT USER
app.get("/me", authMiddleware, (req, res) => {
  db.query(
    "SELECT id, username, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).send("DB error");
      res.json(results[0]);
    }
  );
});

// ================= API =================

app.get("/aircraft-live/:lat/:lon/:range", async (req, res) => {
  try {
    const lat = Number(req.params.lat);
    const lon = Number(req.params.lon);
    const radiusNm = Number(req.params.range);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lon) || lon < -180 || lon > 180 ||
        !Number.isFinite(radiusNm) || radiusNm < 1 || radiusNm > 250) {
      return res.status(400).json({ error: "Latitude/longitude must be valid and range must be 1–250 NM" });
    }

    const result = await aircraftProvider.findByPoint(lat, lon, Math.round(radiusNm));
    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (err) {
    if (err instanceof ProviderError) {
      if (err.retryAfter) res.set("Retry-After", err.retryAfter);
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Aircraft provider request failed:", err.message);
    res.status(502).json({ error: "Aircraft data request failed" });
  }
});

// ================= AIRCRAFT ROUTES =================
app.get("/aircraft-gallery", (req, res) => {
  db.query("SELECT * FROM aircraft_gallery", (err, results) => {
    if (err) return res.status(500).send("DB error");
    res.json(results);
  });
});

// ================= BLOG ROUTES =================

// GET POSTS
app.get("/blog-posts", (req, res) => {
  db.query("SELECT * FROM blog_posts ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).send("DB error");
    res.json(results);
  });
});

// CREATE POST
app.post("/create-post", authMiddleware, (req, res) => {
  const { title, content } = req.body;
  const author = req.user.username;

  db.query(
    "INSERT INTO blog_posts (title, content, author, category) VALUES (?, ?, ?, 'General')",
    [title, content, author],
    err => {
      if (err) return res.status(500).send("Create failed");
      res.send({ message: "Post created" });
    }
  );
});

// EDIT POST
app.put("/edit-post/:id", authMiddleware, (req, res) => {
  const { title, content } = req.body;
  const postId = req.params.id;
  const username = req.user.username;

  db.query("SELECT author FROM blog_posts WHERE id = ?", [postId], (err, results) => {
    if (err) return res.status(500).send("DB error");

    if (results.length === 0) return res.status(404).send("Not found");
    if (results[0].author !== username) return res.status(403).send("Unauthorized");

    db.query(
      "UPDATE blog_posts SET title = ?, content = ? WHERE id = ?",
      [title, content, postId],
      err => {
        if (err) return res.status(500).send("Update failed");
        res.send({ message: "Post updated" });
      }
    );
  });
});

// DELETE POST
app.delete("/delete-post/:id", authMiddleware, (req, res) => {
  const postId = req.params.id;
  const username = req.user.username;

  db.query("SELECT author FROM blog_posts WHERE id = ?", [postId], (err, results) => {
    if (err) return res.status(500).send("DB error");

    if (results.length === 0) return res.status(404).send("Not found");
    if (results[0].author !== username) return res.status(403).send("Unauthorized");

    db.query("DELETE FROM blog_posts WHERE id = ?", [postId], err => {
      if (err) return res.status(500).send("Delete failed");
      res.send({ message: "Post deleted" });
    });
  });
});

// ================= COMMENTS ROUTES =================

// GET COMMENTS BY POST
app.get("/comments/:postId", (req, res) => {
  db.query(
    "SELECT * FROM comments WHERE post_id = ? ORDER BY id DESC",
    [req.params.postId],
    (err, results) => {
      if (err) return res.status(500).send("DB error");
      res.json(results);
    }
  );
});

// GET ALL COMMENTS
app.get("/comments-all", (req, res) => {
  db.query("SELECT * FROM comments ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).send("DB error");
    res.json(results);
  });
});

// ADD COMMENT
app.post("/add-comment", authMiddleware, (req, res) => {
  const { post_id, content } = req.body;
  const author = req.user.username;

  db.query(
    "INSERT INTO comments (post_id, author, content) VALUES (?, ?, ?)",
    [post_id, author, content],
    err => {
      if (err) return res.status(500).send("Failed");
      res.send({ message: "Comment added" });
    }
  );
});

// DELETE COMMENT
app.delete("/delete-comment/:id", authMiddleware, (req, res) => {
  const commentId = req.params.id;
  const username = req.user.username;

  db.query("SELECT author FROM comments WHERE id = ?", [commentId], (err, results) => {
    if (err) return res.status(500).send("DB error");

    if (results.length === 0) return res.status(404).send("Not found");
    if (results[0].author !== username) return res.status(403).send("Unauthorized");

    db.query("DELETE FROM comments WHERE id = ?", [commentId], err => {
      if (err) return res.status(500).send("Delete failed");
      res.send({ message: "Deleted" });
    });
  });
});

// ================= PROFILE ROUTES =================

// EDIT USERNAME
app.put("/edit-username", authMiddleware, (req, res) => {
  const newUsername = req.body.newUsername;
  const currentUser = req.user.username;

  db.query("UPDATE users SET username = ? WHERE username = ?", [newUsername, currentUser], err => {
    if (err) return res.status(500).send("Update failed");

    db.query("UPDATE blog_posts SET author = ? WHERE author = ?", [newUsername, currentUser]);
    db.query("UPDATE comments SET author = ? WHERE author = ?", [newUsername, currentUser]);

    const newToken = jwt.sign(
      { id: req.user.id, username: newUsername },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ message: "Updated", token: newToken });
  });
});

// EDIT PASSWORD
app.put("/edit-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const username = req.user.username;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).send("Server error");

    const user = results[0];
    const match = await bcrypt.compare(currentPassword, user.pswrd);

    if (!match) return res.status(400).json({ message: "Wrong password" });

    const hashed = await bcrypt.hash(newPassword, 10);

    db.query("UPDATE users SET pswrd = ? WHERE username = ?", [hashed, username], err => {
      if (err) return res.status(500).send("Update failed");
      res.send({ message: "Password updated" });
    });
  });
});

// DELETE ACCOUNT
app.delete("/delete-account", authMiddleware, (req, res) => {
  const username = req.user.username;

  db.query("DELETE FROM users WHERE username = ?", [username], err => {
    if (err) return res.status(500).send("Error");
    res.send({ message: "Account deleted" });
  });
});

// ================= SERVER START =================
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
