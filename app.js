import express from "express";
import session from "express-session";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import vehicleRoutes from "./routes/vehicles.js";
import userRoutes from "./routes/users.js";
import logRoutes from "./routes/logs.js";
import tripRoutes from "./routes/trips.js";
import trackingRoutes from "./routes/tracking.js";
import publicRoutes from "./routes/public.js";
import apiRoutes from "./routes/api.js";
import mapRoutes from "./routes/map.js";

dotenv.config();

const app = express(); // ← MUST be declared BEFORE using app

import db from "./config/db.js";

db.query("SELECT 1")
  .then(() => console.log("✅ MySQL connected"))
  .catch(err => console.error("❌ DB Error:", err));
// API 
app.use("/api", apiRoutes);
// Maps
app.use("/map", mapRoutes);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// ✅ Test route (after app is declared)
app.get("/test", (req, res) => {
  res.send("Node.js GPS Vehicle is running 🚀");
});

// Routes
app.use(authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/users", userRoutes);
app.use("/logs", logRoutes);
app.use("/trips", tripRoutes);
app.use("/tracking", trackingRoutes);
app.use("/public", publicRoutes);

// Start server
app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 GPS Vehicle running on port", process.env.PORT || 3000)
);
