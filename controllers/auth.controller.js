import bcrypt from "bcryptjs";
import { db } from "../db/index.js";

export async function login(req, res) {
  const { username, password } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );

  if (!rows.length || !bcrypt.compareSync(password, rows[0].password)) {
    return res.render("login", { error: "Invalid credentials" });
  }

  req.session.user = rows[0];
  res.redirect("/dashboard");
}

export function logout(req, res) {
  req.session.destroy();
  res.redirect("/login");
}
