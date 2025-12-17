import express from "express";
import db from "../config/db.js";
import requireLogin from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireLogin, async (req, res) => {
  const [rows] = await db.query("SELECT * FROM vehicles");
  res.render("vehicles/index", { vehicles: rows });
});

router.get("/add", requireLogin, (req, res) => {
  res.render("vehicles/add");
});

router.post("/add", requireLogin, async (req, res) => {
  const { plate, model } = req.body;
  await db.query(
    "INSERT INTO vehicles (plate, model) VALUES (?, ?)",
    [plate, model]
  );
  res.redirect("/vehicles");
});

router.get("/delete/:id", requireLogin, async (req, res) => {
  await db.query("DELETE FROM vehicles WHERE id = ?", [req.params.id]);
  res.redirect("/vehicles");
});

export default router;
