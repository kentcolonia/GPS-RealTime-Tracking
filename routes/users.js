import express from "express";
import bcrypt from "bcrypt";
import requireLogin from "../middleware/auth.js";
import db from "../config/db.js";

const router = express.Router();

// --- LIST ALL USERS ---
router.get("/", requireLogin, async (req, res) => {
    // Only allow admins to manage users
    if (req.session.user.role !== 'admin') {
        return res.redirect("/dashboard?error=Unauthorized access to User Management");
    }

    try {
        const [users] = await db.query(
            "SELECT id, username, first_name, last_name, role, created_at FROM users ORDER BY id DESC"
        );
        
        res.render("users/index", {
            user: req.session.user,
            users: users,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal Server Error");
    }
});

// --- CREATE NEW USER ---
router.post("/add", requireLogin, async (req, res) => {
    if (req.session.user.role !== 'admin') return res.status(403).send("Unauthorized");

    const { username, password, first_name, last_name, role } = req.body;

    if (!username || !password || !role) {
        return res.redirect("/users?error=Username, Password, and Role are required.");
    }

    try {
        // Check if username already exists
        const [existing] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if (existing.length > 0) {
            return res.redirect("/users?error=Username already taken.");
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into database
        await db.query(
            "INSERT INTO users (username, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)",
            [username, hashedPassword, first_name || null, last_name || null, role]
        );

        res.redirect("/users?success=User created successfully.");
    } catch (error) {
        console.error("Error creating user:", error);
        res.redirect("/users?error=Database error during user creation.");
    }
});

// --- DELETE USER ---
router.post("/delete/:id", requireLogin, async (req, res) => {
    if (req.session.user.role !== 'admin') return res.status(403).send("Unauthorized");
    
    const userIdToDelete = req.params.id;

    // Prevent deleting yourself
    if (parseInt(userIdToDelete) === req.session.user.id) {
        return res.redirect("/users?error=You cannot delete your own account.");
    }

    try {
        await db.query("DELETE FROM users WHERE id = ?", [userIdToDelete]);
        res.redirect("/users?success=User deleted successfully.");
    } catch (error) {
        console.error("Error deleting user:", error);
        res.redirect("/users?error=Database error during deletion.");
    }
});

export default router;