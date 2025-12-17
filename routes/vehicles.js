import express from "express";
import requireLogin from "../middleware/auth.js";
import db from "../config/db.js";

const router = express.Router();

/* VEHICLES LIST VIEW: /vehicles */
router.get("/", requireLogin, async (req, res) => {
    try {
        // SELECT everything, including IMEI, but the EJS view will choose not to display it.
        const [vehicles] = await db.query(
            "SELECT id, imei, plate_number, driver_name, status, updated_at FROM vehicles ORDER BY id DESC"
        );
        
        res.render("vehicles/list", { 
            user: req.session.user, 
            vehicles: vehicles,
            // Extract messages from query params
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("Error fetching vehicles list:", error);
        res.render("vehicles/list", { 
            user: req.session.user, 
            vehicles: [], 
            error: "Failed to load vehicle list. Check server console for DB error.",
            success: null
        });
    }
});

/* ADD NEW VEHICLE: POST /vehicles/add */
router.post("/add", requireLogin, async (req, res) => {
    // Both fields are required for a complete tracking setup
    const { imei, plate_number, driver_name } = req.body;

    if (!plate_number) {
        return res.redirect("/vehicles?error=Vehicle Name / Plate is required.");
    }
    if (!imei) {
        return res.redirect("/vehicles?error=IMEI is required for tracking linkage.");
    }


    try {
        // Check if IMEI already exists (critical for TCP server updates)
        const [existingImei] = await db.query("SELECT id FROM vehicles WHERE imei = ?", [imei]);
        if (existingImei.length > 0) {
            return res.redirect("/vehicles?error=IMEI already registered.");
        }
        
        // Check if Plate Number (Vehicle Name) already exists
        const [existingPlate] = await db.query("SELECT id FROM vehicles WHERE plate_number = ?", [plate_number]);
        if (existingPlate.length > 0) {
            return res.redirect("/vehicles?error=Vehicle Name / Plate already registered.");
        }


        // Insert new vehicle, explicitly including all required columns
        await db.query(
            `INSERT INTO vehicles (imei, plate_number, driver_name, status, latitude, longitude, speed) 
             VALUES (?, ?, ?, 'offline', 0, 0, 0)`,
            [imei, plate_number, driver_name || null]
        );

        res.redirect("/vehicles?success=Vehicle added successfully.");
    } catch (error) {
        console.error("Error adding vehicle:", error);
        res.redirect("/vehicles?error=Database error while adding vehicle. Check server console.");
    }
});

/* DELETE VEHICLE: POST /vehicles/delete */
router.post("/delete/:id", requireLogin, async (req, res) => {
    const { id } = req.params;

    try {
        await db.query("DELETE FROM gps_logs WHERE vehicle_id = ?", [id]); 
        await db.query("DELETE FROM vehicles WHERE id = ?", [id]);

        res.redirect("/vehicles?success=Vehicle deleted successfully.");
    } catch (error) {
        console.error("Error deleting vehicle:", error);
        res.redirect("/vehicles?error=Database error while deleting vehicle.");
    }
});

export default router;