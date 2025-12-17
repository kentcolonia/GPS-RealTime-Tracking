// controllers/tracking.controller.js
export async function ingest(req, res) {
  const { device_id, lat, lng, speed } = req.body;
  await db.query(
    "INSERT INTO gps_logs (device_id, lat, lng, speed) VALUES (?,?,?,?)",
    [device_id, lat, lng, speed]
  );
  res.json({ success: true });
}
