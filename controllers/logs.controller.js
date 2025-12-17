// controllers/logs.controller.js
import { db } from "../db/index.js";

export async function logs(req, res) {
  const [logs] = await db.query(
    "SELECT * FROM gps_logs ORDER BY timestamp DESC LIMIT 500"
  );
  res.render("logs/list", { logs });
}
