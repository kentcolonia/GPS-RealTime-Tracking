import express from "express";
import db from "../config/db.js";

const router = express.Router();

/* GPS DATA INGEST */
router.post("/gps", async (req, res) => {
  const { device_id, vehicle_id, lat, lng, speed } = req.body;

  if (!device_id || !lat || !lng) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  await db.query(
    `INSERT INTO gps_logs 
     (device_id, vehicle_id, latitude, longitude, speed)
     VALUES (?, ?, ?, ?, ?)`,
    [device_id, vehicle_id || null, lat, lng, speed || 0]
  );

  res.json({ status: "OK" });
});

export default router;
