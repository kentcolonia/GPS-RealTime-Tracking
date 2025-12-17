import express from "express";
import requireLogin from "../middleware/auth.js";
import db from "../config/db.js";

const router = express.Router();

/* HISTORY VIEW PAGE: /trips */
router.get("/", requireLogin, async (req, res) => {
    try {
        // FIX: Selecting 'plate_number' which is the correct column name from the SQL schema.
        const [vehicles] = await db.query("SELECT id, plate_number, imei FROM vehicles");
        
        res.render("trips/history", { 
            user: req.session.user, 
            vehicles: vehicles,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Error fetching vehicles for trip history:", error);
        res.render("trips/history", { user: req.session.user, vehicles: [], error: "Failed to load vehicle list." });
    }
});

/* HISTORY API ENDPOINT: /trips/data */
// Fetches all GPS points for a selected vehicle within a date range
router.get("/data", requireLogin, async (req, res) => {
    const { vehicleId, date } = req.query;

    if (!vehicleId || !date) {
        return res.status(400).json({ error: "Missing vehicleId or date parameter." });
    }

    try {
        const startDate = `${date} 00:00:00`;
        const endDate = `${date} 23:59:59`;

        const [rows] = await db.query(
            `SELECT latitude, longitude, speed, created_at 
             FROM gps_logs 
             WHERE vehicle_id = ? AND created_at BETWEEN ? AND ? 
             ORDER BY created_at ASC`,
            [vehicleId, startDate, endDate]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error fetching trip data:", error);
        res.status(500).json({ error: "Failed to retrieve historical trip data." });
    }
});

export default router;