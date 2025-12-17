import express from "express";
import pool from "../db.js";
const router = express.Router();

// Ingest GPS data (from ESP32)
router.post("/ingest", async (req, res) => {
  const { device_id, lat, lng, speed } = req.body;
  if (!device_id || !lat || !lng) return res.status(400).json({ error: "Missing fields" });

  try {
    await pool.query(
      "INSERT INTO gps_logs (device_id, lat, lng, speed) VALUES (?, ?, ?, ?)",
      [device_id, lat, lng, speed || 0]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// Get latest GPS logs
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM gps_logs ORDER BY timestamp DESC LIMIT 50");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

export default router;
