import express from "express";
import requireLogin from "../middleware/auth.js";
import db from "../config/db.js";

const router = express.Router();

router.get("/", requireLogin, async (req, res) => {
    try {
        // 1. Fetch all vehicles for the Sidebar List
        const [vehicles] = await db.query(
            "SELECT id, imei, plate_number, driver_name, status, latitude, longitude, speed, updated_at FROM vehicles ORDER BY plate_number ASC"
        );

        // 2. Fetch Pending Tickets for Admin Subsystems
        let pendingTickets = [];
        if (req.session.user.role === 'admin') {
            const [rows] = await db.query(
                "SELECT id, tt_number FROM trip_tickets WHERE status = 'Pending'"
            );
            pendingTickets = rows;
        }

        res.render("dashboard", {
            user: req.session.user,
            vehicles: vehicles,
            pendingCount: pendingTickets.length,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Dashboard Load Error:", error);
        res.render("dashboard", {
            user: req.session.user,
            vehicles: [],
            pendingCount: 0,
            error: "Failed to load live tracking data."
        });
    }
});

export default router;