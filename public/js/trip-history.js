document.addEventListener('DOMContentLoaded', () => {
    // --- Map Initialization ---
    const map = L.map('map').setView([10.3157, 123.8854], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    document.getElementById('map').style.zIndex = '1';
    map.invalidateSize();

    // --- UI Element References ---
    const vehicleSelect = document.getElementById('vehicleSelect');
    const dateInput = document.getElementById('dateInput');
    const loadTripBtn = document.getElementById('loadTripBtn');
    const messageDisplay = document.getElementById('message');
    
    // Playback Controls (Ensure these IDs exist in your EJS file!)
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const speedSelect = document.getElementById('speedSelect');

    // --- Playback State Variables ---
    let currentPolyline = null;
    let startMarker = null;
    let endMarker = null;
    let playbackMarker = null;
    let playbackData = [];
    let playbackIndex = 0;
    let playbackInterval = null;
    let isPaused = false;
    let playbackSpeed = 500; // Default speed in ms (2 points per second)

    // --- Helper Functions ---
    function showMessage(text, isError = false) {
        messageDisplay.textContent = text;
        messageDisplay.style.backgroundColor = isError ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)';
        messageDisplay.style.display = 'block';
        setTimeout(() => { messageDisplay.style.display = 'none'; }, 4000);
    }
    
    // Icon for the moving playback vehicle
    const getPlaybackIcon = () => L.divIcon({
        className: 'playback-icon',
        html: `<div style="background-color: #f59e0b; color: white; padding: 4px; border-radius: 50%; width: 16px; height: 16px; text-align: center; font-size: 10px; font-weight: bold; border: 3px solid #ffcc00; box-shadow: 0 0 8px rgba(0,0,0,0.7);">🚗</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    // --- Playback Engine ---
    function animatePlayback() {
        if (playbackIndex >= playbackData.length) {
            pausePlayback();
            playBtn.disabled = true;
            showMessage("Playback finished.");
            return;
        }

        const point = playbackData[playbackIndex];
        const latLng = [parseFloat(point.latitude), parseFloat(point.longitude)];
        const time = new Date(point.created_at).toLocaleTimeString();
        const speed = point.speed;

        // Move the marker
        playbackMarker.setLatLng(latLng);
        
        // Update marker popup with current info
        playbackMarker.setPopupContent(`
            Time: <b>${time}</b><br>
            Speed: <b>${speed} km/h</b>
        `);
        
        // Ensure the map follows the marker (optional)
        // map.setView(latLng, map.getZoom()); 

        playbackIndex++;
    }

    function startPlayback() {
        if (playbackInterval) clearInterval(playbackInterval);
        
        // If we reached the end, rewind to start
        if (playbackIndex >= playbackData.length) {
             playbackIndex = 0;
        }

        playbackInterval = setInterval(animatePlayback, playbackSpeed);
        isPaused = false;
        playBtn.disabled = true;
        pauseBtn.disabled = false;
        showMessage("Playback started.");
    }

    function pausePlayback() {
        if (playbackInterval) clearInterval(playbackInterval);
        isPaused = true;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        showMessage(`Playback paused at point ${playbackIndex}.`);
    }

    // --- Event Listeners ---
    loadTripBtn.addEventListener('click', loadTripHistory);
    playBtn.addEventListener('click', startPlayback);
    pauseBtn.addEventListener('click', pausePlayback);
    
    speedSelect.addEventListener('change', (e) => {
        // Map speed values (e.g., 1x, 2x, 4x, 8x) to interval milliseconds
        const speedFactor = parseFloat(e.target.value);
        playbackSpeed = 1000 / speedFactor; // 1000ms / factor
        
        if (playbackInterval) {
            // Restart interval with new speed if currently playing
            startPlayback();
        }
    });

    // --- Main Data Loader ---
    async function loadTripHistory() {
        const vehicleId = vehicleSelect.value;
        const date = dateInput.value;

        if (!vehicleId) {
            return showMessage("Please select a vehicle.", true);
        }
        if (!date) {
            return showMessage("Please select a date.", true);
        }

        showMessage("Loading trip data...", false);
        loadTripBtn.disabled = true;

        // 1. Clear previous state and map layers
        if (currentPolyline) map.removeLayer(currentPolyline);
        if (startMarker) map.removeLayer(startMarker);
        if (endMarker) map.removeLayer(endMarker);
        if (playbackMarker) map.removeLayer(playbackMarker);
        pausePlayback(); // Ensure interval is cleared

        try {
            const response = await fetch(`/trips/data?vehicleId=${vehicleId}&date=${date}`);
            const data = await response.json();

            if (!response.ok || data.error) {
                return showMessage(data.error || "Failed to fetch trip data from server.", true);
            }

            if (data.length === 0) {
                return showMessage("No trip data found for this vehicle on this date.", false);
            }
            
            playbackData = data;
            playbackIndex = 0;
            
            // 2. Extract coordinates and draw the Polyline
            const latLngs = data.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);

            currentPolyline = L.polyline(latLngs, {
                color: '#2563eb', // Blue line
                weight: 4,
                opacity: 0.8
            }).addTo(map);

            // 3. Add Start, End, and Playback Markers
            const startPoint = latLngs[0];
            const endPoint = latLngs[latLngs.length - 1];
            
            // Icon helper function for start/end
            const getEndpointIcon = (color, label) => L.divIcon({
                className: 'trip-endpoint-icon',
                html: `<div style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">${label}</div>`,
                iconSize: [60, 24],
                iconAnchor: [30, 12]
            });

            startMarker = L.marker(startPoint, { icon: getEndpointIcon('#059669', 'START') }) // Green for start
                .bindPopup(`Start: ${new Date(data[0].created_at).toLocaleTimeString()}`)
                .addTo(map);

            endMarker = L.marker(endPoint, { icon: getEndpointIcon('#ef4444', 'END') }) // Red for end
                .bindPopup(`End: ${new Date(data[data.length - 1].created_at).toLocaleTimeString()}`)
                .addTo(map);

            // Initialize playback marker at the start point
            playbackMarker = L.marker(startPoint, { icon: getPlaybackIcon() })
                .bindPopup('Playback Marker', { autoClose: false, closeOnClick: false })
                .openPopup()
                .addTo(map);

            // 4. Center map to fit the entire route
            map.fitBounds(currentPolyline.getBounds());
            
            // Enable playback buttons
            playBtn.disabled = false;
            pauseBtn.disabled = true; // Start paused

            showMessage(`Trip loaded successfully! Total ${data.length} points.`);

        } catch (error) {
            console.error("Client side error loading trip:", error);
            showMessage("An unexpected error occurred on the client side.", true);
        } finally {
            loadTripBtn.disabled = false;
        }
    }
});