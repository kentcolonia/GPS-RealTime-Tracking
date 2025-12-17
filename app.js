import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import net from "net"; // Required for GPS TCP Listener

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

const app = express(); 
const WEB_PORT = process.env.PORT || 3000;
const GPS_PORT = process.env.GPS_PORT || 3001; // Port for GPS devices

import db from "./config/db.js";

db.query("SELECT 1")
  .then(() => console.log("✅ MySQL connected"))
  .catch(err => console.error("❌ DB Error:", err));

// --- CORE MIDDLEWARE ---
// 1. Static Files
app.use(express.static("public")); 

// 2. Session Middleware: MUST BE DEFINED FIRST for auth checks to work
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// 3. Body Parsers (Must come after session)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");

// ===========================================
//  ROUTES
// ===========================================

// Root Path Redirect: Redirects the base URL to dashboard or login
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect("/dashboard");
    }
    res.redirect("/login");
});

// Test route
app.get("/test", (req, res) => {
  res.send("Node.js GPS Vehicle is running 🚀");
});


// Main Application Routes 
app.use(authRoutes); // Handles /login and /logout
app.use("/dashboard", dashboardRoutes);
app.use("/map", mapRoutes); 
app.use("/api", apiRoutes); 
app.use("/vehicles", vehicleRoutes);
app.use("/users", userRoutes);
app.use("/logs", logRoutes);
app.use("/trips", tripRoutes);
app.use("/tracking", trackingRoutes);
app.use("/public", publicRoutes);


// 404/Fallback Route: MUST be the last route defined.
app.use((req, res, next) => {
    if (req.session.user) {
        // Safe fallback for any invalid path
        return res.redirect("/dashboard"); 
    }
    // If not logged in, ensure they go to the login page
    res.redirect("/login");
});


// ==========================================
//  PART 2: GPS INGESTION SERVER (Enhanced)
// ==========================================

// Helper function to handle different GPS protocols
async function parseGpsData(rawData) {
    // This is the core logic you will expand as you add more devices.
    
    // --- 1. Detect Protocol (Ignoring NMEA/Hex for now, focus on custom ESP32 CSV) ---
    
    // --- 2. Custom ESP32 CSV Protocol ---
    // Expected format: IMEI,LAT,LNG,SPEED,BATTERY
    const parts = rawData.split(','); 
    if (parts.length >= 5) {
        return {
            protocol: 'ESP32_CUSTOM_CSV',
            imei: parts[0],
            lat: parts[1],
            lng: parts[2],
            speed: parseFloat(parts[3]) || 0,
            battery: parseFloat(parts[4]) || null
        };
    }
    
    // --- 3. Default to Placeholder CSV (Older format) ---
    if (parts.length >= 3) {
        return {
            protocol: 'CSV_PLACEHOLDER',
            imei: parts[0],
            lat: parts[1],
            lng: parts[2],
            speed: parseFloat(parts[3]) || 0,
            battery: null
        };
    }

    // NMEA and Hex logic remains as warnings for future expansion
    if (rawData.startsWith('$GPRMC') || rawData.startsWith('$GPGGA')) {
        console.warn("NMEA Protocol detected. Requires specialized parser.");
    } 
    if (rawData.length > 50 && rawData.match(/^[0-9A-Fa-f]+$/)) {
        console.warn("Binary/Hex Protocol detected. Requires dedicated decoder.");
    }
    
    return null; // Data could not be parsed
}


const gpsServer = net.createServer((socket) => {
  console.log(`📡 Device connected: ${socket.remoteAddress}:${socket.remotePort}`);
  
  socket.setEncoding('utf8'); 

  socket.on('data', async (data) => {
    const rawData = data.toString().trim();
    console.log(`📥 Raw Data: ${rawData}`);
    
    try {
      const parsedData = await parseGpsData(rawData);
      
      if (!parsedData) {
          console.warn("⚠️ Data rejected: Unrecognized or incomplete packet.");
          // Acknowledge failure for the device to potentially retry
          socket.write('ERROR\n'); 
          return;
      }

      const { imei, lat, lng, speed, battery } = parsedData;

      // 1. Update the vehicle's current location (for the map view)
      await db.query(
        `UPDATE vehicles 
         SET lat = ?, lng = ?, speed = ?, battery_level = ?, updated_at = NOW(), status = 'online'
         WHERE imei = ?`, 
        [lat, lng, speed, battery, imei]
      );
      
      // 2. Insert into history logs
      const [vehicleRow] = await db.query(
        `SELECT id FROM vehicles WHERE imei = ?`, [imei]
      );
      
      if (vehicleRow && vehicleRow.length > 0) {
           await db.query(
             `INSERT INTO gps_logs (vehicle_id, latitude, longitude, speed, battery_level, created_at) 
              VALUES (?, ?, ?, ?, ?, NOW())`,
             [vehicleRow[0].id, lat, lng, speed, battery]
           );
      }

      console.log(`✅ Position saved for ${imei}: ${lat}, ${lng} (Protocol: ${parsedData.protocol})`);
      
      // CRITICAL: Send ACK back to the device (often required by TCP protocols)
      socket.write('ACK\n'); 

    } catch (err) {
      console.error("❌ GPS Processing Error:", err);
      socket.write('ERROR\n'); // Send error ACK
    }
  });

  socket.on('end', () => console.log('📴 Device disconnected'));
  socket.on('error', (err) => console.error('⚠️ Connection error:', err));
});

// Start the GPS Listener
gpsServer.listen(GPS_PORT, () => {
  console.log(`🛰️  GPS TCP Server listening on port ${GPS_PORT}`);
});


// Start server
app.listen(WEB_PORT, () =>
  console.log(`🚀 Web Dashboard running on port ${WEB_PORT}`)
);