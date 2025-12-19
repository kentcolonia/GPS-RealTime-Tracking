import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import net from "net";

// --- Route Imports ---
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
import tripTicketRoutes from "./routes/trip_tickets.js"; 


import db from "./config/db.js";

dotenv.config();

const app = express();
const WEB_PORT = process.env.PORT || 3000;
const GPS_PORT = process.env.GPS_PORT || 3001;

// Database Connection Check
db.query("SELECT 1")
  .then(() => console.log("✅ MySQL connected"))
  .catch(err => console.error("❌ DB Error:", err));

// --- Global Middleware ---
app.use("/api", apiRoutes); // API routes often don't need sessions
app.use("/map", mapRoutes); 

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// --- Route Registration ---
app.use(authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/users", userRoutes);
app.use("/logs", logRoutes);
app.use("/trips", tripRoutes);
app.use("/tracking", trackingRoutes);
app.use("/public", publicRoutes);
app.use("/trip-tickets", tripTicketRoutes); // Registering the Trip Ticket system


// --- Root Redirect ---
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.redirect("/login");
});

// --- Web Server Start ---
app.listen(WEB_PORT, () =>
  console.log(`🚀 Web Dashboard running on http://localhost:${WEB_PORT}`)
);

// --- GPS TCP INGESTION SERVER ---
// This handles the real-time data from your ESP32
const gpsServer = net.createServer((socket) => {
  console.log('📡 Device connected for GPS data');

  socket.on('data', async (data) => {
    try {
      const rawData = data.toString().trim();
      console.log(`📥 Incoming GPS: ${rawData}`);
      
      const parts = rawData.split(','); 
      
      // Expected Format from ESP32: IMEI,Latitude,Longitude,Speed
      if (parts.length >= 3) { 
        const imei = parts[0];
        const lat = parts[1];
        const lng = parts[2];
        const speed = parts[3] || 0;

        // 1. Update current location in 'vehicles' table
        await db.query(
          `UPDATE vehicles 
           SET latitude = ?, longitude = ?, speed = ?, updated_at = NOW(), status = 'online'
           WHERE imei = ?`, 
          [lat, lng, speed, imei]
        );
        
        // 2. Insert into history logs (for Trip History & Playback)
        await db.query(
          `INSERT INTO gps_logs (vehicle_id, latitude, longitude, speed) 
           SELECT id, ?, ?, ? FROM vehicles WHERE imei = ?`,
          [lat, lng, speed, imei]
        );

        // Acknowledge the data (Optional: helps ESP32 know data was received)
        socket.write('ACK\n');
      }
    } catch (err) {
      console.error("❌ GPS Processing Error:", err);
    }
  });

  socket.on('error', (err) => console.error('Socket error:', err));
  socket.on('end', () => console.log('📴 Device disconnected'));
});

gpsServer.listen(GPS_PORT, () => {
  console.log(`🛰️  GPS TCP Server listening on port ${GPS_PORT}`);
});