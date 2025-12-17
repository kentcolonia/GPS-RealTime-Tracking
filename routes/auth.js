import express from "express";
import bcrypt from "bcrypt";
import db from "../config/db.js";

const router = express.Router();

/* LOGIN PAGE */
router.get("/login", (req, res) => {
  // If the user is already logged in, redirect them away from the login page
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.render("auth/login", { error: req.query.error || null });
});

/* LOGIN PROCESS */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT id, username, password, role FROM users WHERE username = ?",
      [username]
    );

    // 1. Check if user exists
    if (rows.length === 0) {
      // Use query string for cleaner URL after redirect
      return res.redirect("/login?error=Invalid%20login"); 
    }

    const user = rows[0];
    
    // 2. Check if password matches
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.redirect("/login?error=Invalid%20login");
    }

    // 3. Authentication successful: Set session data
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    // 4. Crucial: Explicitly save the session before redirecting
    // This resolves issues where the redirect happens before the session store finishes writing
    req.session.save(err => {
      if (err) {
        console.error("Session Save Error:", err);
        return res.redirect("/login?error=Session%20error");
      }
      res.redirect("/dashboard");
    });

  } catch (error) {
    console.error("Database or Login Error:", error);
    res.redirect("/login?error=Server%20error");
  }
});

/* LOGOUT */
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

export default router;