import express from "express";
import requireLogin from "../middleware/auth.js";
import db from "../config/db.js";

const router = express.Router();

/* LIST VIEW: /trip-tickets */
router.get("/", requireLogin, async (req, res) => {
    try {
        const [vehicles] = await db.query("SELECT id, plate_number FROM vehicles ORDER BY plate_number ASC");
        
        let sql = `
            SELECT tt.*, v.plate_number as vehicle_name, u.username as created_by
            FROM trip_tickets tt
            JOIN vehicles v ON tt.vehicle_id = v.id
            JOIN users u ON tt.created_by_id = u.id
        `;
        
        const params = [];
        if (req.session.user.role !== 'admin') {
            sql += " WHERE tt.created_by_id = ?";
            params.push(req.session.user.id);
        }
        
        sql += " ORDER BY tt.trip_date DESC, tt.id DESC";
        const [tickets] = await db.query(sql, params);

        res.render("trip_tickets/index", {
            user: req.session.user,
            vehicles,
            tickets,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("CRITICAL ERROR in /trip-tickets:", error.message);
        res.status(500).send(`Server Error: ${error.message}`);
    }
});

/* APPROVALS DASHBOARD: /trip-tickets/approvals */
router.get("/approvals", requireLogin, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect("/trip-tickets?error=Unauthorized access");
    }

    try {
        const sql = `
            SELECT 
                tt.*,
                v.plate_number AS vehicle_name,
                u_creator.username AS created_by
            FROM trip_tickets tt
            JOIN vehicles v ON tt.vehicle_id = v.id
            JOIN users u_creator ON tt.created_by_id = u_creator.id
            WHERE tt.status IN ('Pending', 'Approved')
            ORDER BY FIELD(tt.status, 'Pending', 'Approved'), tt.trip_date ASC, tt.id ASC
        `;
        
        const [approvalTickets] = await db.query(sql);

        res.render("trip_tickets/approvals", {
            user: req.session.user,
            tickets: approvalTickets,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Error loading approvals:", error);
        res.status(500).send("Internal Server Error");
    }
});

/* PRINT VIEW: /trip-tickets/print/:id */
router.get("/print/:id", requireLogin, async (req, res) => {
    try {
        const [tickets] = await db.query(
            `SELECT 
                tt.*,
                v.plate_number,
                u_creator.username AS created_by,
                u_approver.username AS approver_name
            FROM trip_tickets tt
            JOIN vehicles v ON tt.vehicle_id = v.id
            JOIN users u_creator ON tt.created_by_id = u_creator.id
            LEFT JOIN users u_approver ON tt.approver_id = u_approver.id
            WHERE tt.id = ? AND tt.status IN ('Approved', 'Completed')`,
            [req.params.id]
        );

        if (tickets.length === 0) {
            return res.status(404).send("Ticket not found or not yet approved.");
        }

        res.render("trip_tickets/print", {
            ticket: tickets[0]
        });
    } catch (error) {
        console.error("Error fetching print data:", error);
        res.status(500).send("Internal Server Error");
    }
});

/* ACTION: APPROVE TICKET */
router.get("/approve/:id", requireLogin, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect("/trip-tickets?error=Unauthorized action");
    }

    const ticketId = req.params.id;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [tickets] = await connection.query(
            "SELECT vehicle_id, start_odometer FROM trip_tickets WHERE id = ? AND status = 'Pending'",
            [ticketId]
        );

        if (tickets.length === 0) {
            await connection.rollback();
            return res.redirect("/trip-tickets/approvals?error=Ticket not found or already processed");
        }

        const { vehicle_id, start_odometer } = tickets[0];

        await connection.query(
            "UPDATE trip_tickets SET status = 'Approved', approver_id = ?, approval_date = NOW() WHERE id = ?",
            [req.session.user.id, ticketId]
        );

        if (vehicle_id && start_odometer !== null) {
            await connection.query(
                `UPDATE trip_tickets 
                 SET end_odometer = ? 
                 WHERE vehicle_id = ? AND id < ? AND end_odometer IS NULL 
                 ORDER BY id DESC 
                 LIMIT 1`,
                [start_odometer, vehicle_id, ticketId]
            );
        }

        await connection.commit();
        res.redirect("/trip-tickets/approvals?success=Ticket approved successfully");

    } catch (error) {
        await connection.rollback();
        console.error("Approval transaction failed:", error);
        res.redirect("/trip-tickets/approvals?error=Database error during approval");
    } finally {
        connection.release();
    }
});

/* CREATE TICKET: POST /trip-tickets/create */
router.post("/create", requireLogin, async (req, res) => {
    const { vehicle_id, custodian, driver_name, trip_date, destination_from, destination_to, purpose, start_odometer } = req.body;

    try {
        const datePrefix = new Date().toISOString().slice(0, 7).replace('-', ''); 
        const [lastTicket] = await db.query(
            "SELECT tt_number FROM trip_tickets WHERE tt_number LIKE ? ORDER BY id DESC LIMIT 1",
            [`${datePrefix}-%`]
        );

        let nextSerial = 1;
        if (lastTicket.length > 0) {
            const lastParts = lastTicket[0].tt_number.split('-');
            nextSerial = parseInt(lastParts[1]) + 1;
        }
        const tt_number = `${datePrefix}-${String(nextSerial).padStart(2, '0')}`;

        await db.query(
            `INSERT INTO trip_tickets (tt_number, vehicle_id, custodian, driver_name, trip_date, destination_from, destination_to, purpose, start_odometer, created_by_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tt_number, vehicle_id, custodian, driver_name, trip_date, destination_from, destination_to, purpose, start_odometer || 0, req.session.user.id]
        );

        res.redirect("/trip-tickets?success=Ticket created: " + tt_number);
    } catch (error) {
        console.error("Error creating ticket:", error);
        res.redirect("/trip-tickets?error=Failed to create ticket");
    }
});

/* DELETE TICKET: POST /trip-tickets/delete/:id */
router.post("/delete/:id", requireLogin, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const [ticket] = await db.query("SELECT created_by_id, status FROM trip_tickets WHERE id = ?", [ticketId]);
        if (ticket.length === 0) return res.redirect("/trip-tickets?error=Ticket not found");
        const canDelete = req.session.user.role === 'admin' || (ticket[0].status === 'Pending' && ticket[0].created_by_id === req.session.user.id);
        if (!canDelete) return res.redirect("/trip-tickets?error=Unauthorized deletion.");
        await db.query("DELETE FROM trip_tickets WHERE id = ?", [ticketId]);
        res.redirect("/trip-tickets?success=Ticket successfully deleted.");
    } catch (error) {
        console.error("Error deleting ticket:", error);
        res.redirect("/trip-tickets?error=Failed to delete ticket.");
    }
});

/* GET LAST ODOMETER: /trip-tickets/last-odometer/:vehicleId */
router.get("/last-odometer/:vehicleId", requireLogin, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT end_odometer FROM trip_tickets WHERE vehicle_id = ? AND status = 'Completed' ORDER BY trip_date DESC, id DESC LIMIT 1",
            [req.params.vehicleId]
        );
        res.json({ last_odometer: rows.length > 0 ? rows[0].end_odometer : 0 });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch odometer" });
    }
});

export default router;