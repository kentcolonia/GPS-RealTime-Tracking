import net from 'net';
import db from './config/db.js'; // Ensure this points to your DB config

const GPS_PORT = process.env.GPS_PORT || 3001;

// --- Helper: Parse Data ---
// We expect a simple CSV format: "IMEI,LAT,LNG,SPEED,BATTERY"
// Example: "123456789012345,10.3157,123.8854,45.5,98"
function parseData(rawData) {
    const parts = rawData.toString().trim().split(',');
    
    // Basic validation
    if (parts.length < 3) return null;

    return {
        imei: parts[0],
        lat: parseFloat(parts[1]),
        lng: parseFloat(parts[2]),
        speed: parseFloat(parts[3]) || 0,
        battery: parseFloat(parts[4]) || null
    };
}

// --- TCP Server Logic ---
const server = net.createServer((socket) => {
    console.log(`[${new Date().toISOString()}] New Connection: ${socket.remoteAddress}`);

    socket.on('data', async (data) => {
        try {
            const rawString = data.toString().trim();
            console.log(`📥 Received: ${rawString}`);

            const parsed = parseData(rawString);

            if (!parsed || isNaN(parsed.lat) || isNaN(parsed.lng)) {
                console.warn("⚠️ Invalid Data Format");
                return;
            }

            const { imei, lat, lng, speed, battery } = parsed;

            // 1. Update Live Position (for Dashboard Map)
            // We use 'ON DUPLICATE KEY UPDATE' logic logic via a direct UPDATE query
            // First, check if vehicle exists to avoid errors
            const [vehicle] = await db.query("SELECT id FROM vehicles WHERE imei = ?", [imei]);

            if (vehicle.length > 0) {
                const vehicleId = vehicle[0].id;

                // Update 'vehicles' table (Current State)
                await db.query(
                    `UPDATE vehicles 
                     SET latitude = ?, longitude = ?, speed = ?, battery_level = ?, status = 'online', updated_at = NOW() 
                     WHERE id = ?`,
                    [lat, lng, speed, battery, vehicleId]
                );

                // 2. Insert into History Logs (for Trip Playback)
                await db.query(
                    `INSERT INTO gps_logs (vehicle_id, latitude, longitude, speed, battery_level, created_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [vehicleId, lat, lng, speed, battery]
                );

                console.log(`✅ Saved: ${imei} @ [${lat}, ${lng}]`);
                
                // 3. Send Acknowledgement to ESP32
                // This tells the device "I got it, you can sleep or send the next point"
                socket.write("ACK\n"); 
            } else {
                console.warn(`⚠️ Unknown Device IMEI: ${imei}. Register it in the dashboard first.`);
                socket.write("ERROR_UNREGISTERED\n");
            }

        } catch (error) {
            console.error("❌ Processing Error:", error.message);
        }
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });

    socket.on('error', (err) => {
        console.error('Socket Error:', err.message);
    });
});

// --- Start Listening ---
server.listen(GPS_PORT, () => {
    console.log(`
    📡 GPS TCP Server running on port ${GPS_PORT}
    --------------------------------------------
    Target your ESP32 to:
    IP:   [Your Server Public IP]
    Port: ${GPS_PORT}
    
    Expected Format: IMEI,LAT,LNG,SPEED,BATTERY
    `);
});