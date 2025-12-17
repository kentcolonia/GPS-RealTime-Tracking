import express from "express";
import bcrypt from "bcrypt";
import db from "../config/db.js";

const router = express.Router();

/* LOGIN PAGE */
router.get("/login", (req, res) => {
  res.render("auth/login");
});

/* LOGIN PROCESS */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return res.render("auth/login", { error: "Invalid login" });
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.render("auth/login", { error: "Invalid login" });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  res.redirect("/dashboard");
});

/* LOGOUT */
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

export default router;
