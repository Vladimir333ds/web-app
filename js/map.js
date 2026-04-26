// ================= MAP INITIALIZATION =================
const map = L.map("map", {
  minZoom: 2,
  maxZoom: 10
}).setView([20, 0], 2);

const bounds = L.latLngBounds([-85, -180], [85, 180]);
map.setMaxBounds(bounds);

// ================= TILE LAYERS =================
const lightTiles = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
);

const darkTiles = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
);

function initMapTheme() {
  const isDark = localStorage.getItem("theme") === "dark";
  (isDark ? darkTiles : lightTiles).addTo(map);
}

function applyMapTheme() {
  const isDark = document.body.classList.contains("dark-mode");

  if (isDark) {
    map.removeLayer(lightTiles);
    map.addLayer(darkTiles);
  } else {
    map.removeLayer(darkTiles);
    map.addLayer(lightTiles);
  }
}

// ================= GLOBAL STATE =================
const planeIcon = L.icon({
  iconUrl: "./assets/plane.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

let selectedLat = null;
let selectedLon = null;
let rangeCircle = null;
let centerMarker = null;

const aircraftLayer = L.layerGroup().addTo(map);

// ================= DOM REFERENCES =================
let rangeSet;
let output;

// ================= DOM READY =================
document.addEventListener("DOMContentLoaded", () => {
  initMapTheme();

  // Dark mode toggle
  const darkBtn = document.getElementById("darkToggle");
  if (darkBtn) {
    darkBtn.addEventListener("click", () => {
      setTimeout(applyMapTheme, 50);
    });
  }

  // Controls panel toggle
  const toggleBtn = document.getElementById("togglePanel");
  const controls = document.getElementById("controls");

  if (toggleBtn && controls) {
    toggleBtn.addEventListener("click", () => {
      controls.classList.toggle("collapsed");

      toggleBtn.textContent =
        controls.classList.contains("collapsed") ? "▲" : "▼";
    });
  }

  // Range slider
  rangeSet = document.getElementById("rng");
  output = document.getElementById("range_disp");

  if (rangeSet && output) {
    output.textContent = rangeSet.value;

    rangeSet.oninput = function () {
      output.textContent = this.value;
      drawRangeCircle();
    };
  }

  // Search button
  const searchBtn = document.getElementById("search");
  if (searchBtn) {
    searchBtn.onclick = searchAircraft;
  }
});

// ================= MAP CLICK HANDLER =================
map.on("click", (e) => {
  selectedLat = e.latlng.lat.toFixed(6);
  selectedLon = e.latlng.lng.toFixed(6);

  document.getElementById("lat").value = selectedLat;
  document.getElementById("lon").value = selectedLon;

  if (centerMarker) {
    centerMarker.setLatLng(e.latlng);
  } else {
    centerMarker = L.marker(e.latlng).addTo(map);
  }

  drawRangeCircle();
});

// ================= RANGE CIRCLE =================
function drawRangeCircle() {
  if (!selectedLat || !selectedLon || !rangeSet) return;

  const radiusMeters = rangeSet.value * 1000;

  if (rangeCircle) {
    map.removeLayer(rangeCircle);
  }

  rangeCircle = L.circle([selectedLat, selectedLon], {
    radius: radiusMeters,
    color: "#1e88e5",
    fillOpacity: 0.08
  }).addTo(map);
}

// ================= AIRCRAFT SEARCH =================

async function searchAircraft() {
  if (!selectedLat || !selectedLon) {
    alert("Select location first");
    return;
  }

  aircraftLayer.clearLayers();

  try {
    const res = await fetch(
      `https://web-app-p5sr.onrender.com/aircraft-live/${selectedLat}/${selectedLon}/${rangeSet.value}`
    );

    const aircraft = await res.json();

    aircraft.forEach((plane) => {
      if (!plane.lat || !plane.lon) return;

      const marker = L.marker([plane.lat, plane.lon], {
        icon: planeIcon,
        rotationAngle: plane.heading || 0
      }).addTo(aircraftLayer);

      marker.bindPopup(`
        <strong>${plane.callsign || "Unknown"}</strong><br>
        Altitude: ${plane.baroAltitude ?? "N/A"} ft<br>

        <button class="btn btn-sm btn-primary w-100 mt-2" id="details-${plane.icao}">
          <i class="bi bi-info-circle"></i> View Details
        </button>
      `);

      marker.on("popupopen", () => {
        const btn = document.getElementById(`details-${plane.icao}`);
        if (btn) {
          btn.onclick = () => openDetails(plane);
        }
      });
    });

    showToast(`Loaded ${aircraft.length} aircraft`);

  } catch (err) {
    console.error(err);
    showToast("Failed to load aircraft");
  }
}

// ================= AIRCRAFT DETAILS =================
function openDetails(plane) {
  const details = document.getElementById("aircraftDetails");
  const content = document.getElementById("detailsContent");

  content.innerHTML = `
    <p><strong>Callsign:</strong> ${plane.callsign || "N/A"}</p>
    <p><strong>ICAO:</strong> ${plane.icao}</p>
    <p><strong>Registration:</strong> ${plane.reg || "N/A"}</p>
    <p><strong>Type:</strong> ${plane.type || "Unknown"}</p>
    <p><strong>Altitude:</strong> ${plane.baroAltitude ?? "N/A"} ft</p>
    <p><strong>Speed:</strong> ${plane.speed ?? "N/A"} kt</p>
  `;

  details.classList.remove("hidden");
}

function closeDetails() {
  document.getElementById("aircraftDetails").classList.add("hidden");
}

// ================= TOAST =================
function showToast(message, duration = 2000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}