import express from "express";
import db from "../config/db.js";
import requireLogin from "../middleware/auth.js";

const router = express.Router();

/* MAP PAGE */
router.get("/", requireLogin, (req, res) => {
  res.render("map");
});

/* LATEST GPS DATA */
router.get("/data", requireLogin, async (req, res) => {
  const [rows] = await db.query(`
    SELECT v.id, v.plate, v.model,
           g.latitude, g.longitude, g.speed, g.created_at
    FROM vehicles v
    LEFT JOIN gps_logs g ON g.id = (
      SELECT id FROM gps_logs
      WHERE vehicle_id = v.id
      ORDER BY created_at DESC
      LIMIT 1
    )
  `);

  res.json(rows);
});

export default router;
