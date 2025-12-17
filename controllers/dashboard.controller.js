// controllers/dashboard.controller.js
import { db } from "../db/index.js";

export async function dashboard(req, res) {
  const [[v]] = await db.query("SELECT COUNT(*) total FROM vehicles");
  const [[u]] = await db.query("SELECT COUNT(*) total FROM users");
  res.render("dashboard", { vehicles: v.total, users: u.total });
}
 