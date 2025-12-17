// Initialize Map, centered around Cebu
const map = L.map('map').setView([10.3157, 123.8854], 13); 

// Add Tile Layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// FIX FOR CLICKABILITY: Crucial for Leaflet when embedded in complex layouts.
// We force specific styles to ensure the map receives mouse events.
const mapContainer = document.getElementById('map');
mapContainer.style.zIndex = '1'; 
mapContainer.style.position = 'relative'; // REQUIRED for z-index to work
mapContainer.style.pointerEvents = 'auto'; // Force enable mouse interaction
map.invalidateSize(); // Forces Leaflet to recalculate map size and redraw tiles

// Store markers by vehicle ID (v.id)
const markers = {};

// Custom Icon function
function getIcon(status) {
    const color = status === 'online' ? '#2563eb' : '#94a3b8'; // Blue for online, Gray for offline/idle
    return L.divIcon({
        className: 'custom-icon',
        // Simple circle icon with a white border
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

// Function to fetch data from your API
async function updateLocations() {
    try {
        // CORRECTED ENDPOINT: Use the /map/data route defined in routes/map.js
        const response = await fetch('/map/data');
        
        if (response.status === 401) {
            console.warn("User session expired. Redirecting to login.");
            // window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const vehicles = await response.json();

        vehicles.forEach(vehicle => {
            // Data structure matching the SQL query columns: id, plate, latitude, longitude, speed, created_at
            const { id, plate, model, latitude, longitude, speed, created_at } = vehicle;
            
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            const uniqueId = id; 
            
            // Infer status (Online if moving and recently updated)
            const status = speed > 0 && (Date.now() - new Date(created_at).getTime() < 30000) ? 'online' : 'idle'; 

            // Validation: Skip if location data is missing or invalid
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

            if (markers[uniqueId]) {
                // UPDATE existing marker
                const marker = markers[uniqueId];
                
                // Set new position
                marker.setLatLng([lat, lng]);
                marker.setIcon(getIcon(status));
                
                // Update Popup content
                marker.setPopupContent(`
                    <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 4px;">
                        <b style="color: #1e40af;">${plate || 'Vehicle ' + uniqueId}</b><br>
                        Model: ${model || 'N/A'}<br>
                        Speed: <span style="font-weight: bold;">${speed} km/h</span><br>
                        Status: <span style="font-weight: bold; color: ${status === 'online' ? '#059669' : '#71717a'};">${status.toUpperCase()}</span><br>
                        Last Seen: ${new Date(created_at).toLocaleTimeString()}
                    </div>
                `);

            } else {
                // CREATE new marker
                const newMarker = L.marker([lat, lng], { icon: getIcon(status) })
                    .bindPopup(`
                        <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 4px;">
                            <b style="color: #1e40af;">${plate || 'Vehicle ' + uniqueId}</b><br>
                            Model: ${model || 'N/A'}<br>
                            Speed: <span style="font-weight: bold;">${speed} km/h</span><br>
                            Status: <span style="font-weight: bold; color: ${status === 'online' ? '#059669' : '#71717a'};">${status.toUpperCase()}</span><br>
                            Last Seen: ${new Date(created_at).toLocaleTimeString()}
                        </div>
                    `)
                    .addTo(map);
                
                markers[uniqueId] = newMarker;
                // Center map on the first vehicle found
                if (Object.keys(markers).length === 1) {
                    map.setView([lat, lng], 14);
                }
            }
        });

    } catch (error) {
        console.error("Error fetching vehicle data:", error);
    }
}

// Poll the server every 2 seconds
setInterval(updateLocations, 2000);

// Initial call
updateLocations();