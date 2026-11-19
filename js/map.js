// ================= MAP INITIALIZATION =================
const map = L.map("map", {
  minZoom: 2,
  maxZoom: 10
}).setView([20, 0], 2);

const bounds = L.latLngBounds([-85, -180], [85, 180]);
map.setMaxBounds(bounds);

// ================= TILE LAYERS =================
const lightTiles = L.tileLayer(
  `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(window.APP_CONFIG?.cartoBasemapKey || "")}`,
  { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }
);

const darkTiles = L.tileLayer(
  `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(window.APP_CONFIG?.cartoBasemapKey || "")}`,
  { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }
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
let activeAircraftCallout = null;
let previouslyFocusedElement = null;

// ================= DOM REFERENCES =================
let rangeSet;
let output;

// ================= DOM READY =================
document.addEventListener("DOMContentLoaded", () => {
  initMapTheme();

  // Handle this action at the map container so Leaflet's draggable marker
  // cannot swallow the click before it reaches the button.
  map.getContainer().addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest(".atc-callout__details");
    if (!button || !activeAircraftCallout) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDetails(activeAircraftCallout.plane);
  }, true);

  const detailsDialog = document.getElementById("aircraftDetails");
  detailsDialog?.addEventListener("click", event => {
    if (event.target.matches("[data-close-details]")) closeDetails();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDetails();
  });

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

  const total = document.getElementById("total");
  if (total) total.textContent = "Choose an area to see aircraft";

  // Search button
  const searchBtn = document.getElementById("search");
  if (searchBtn) {
    searchBtn.onclick = searchAircraft;
  }
});

// ================= MAP CLICK HANDLER =================
map.on("click", (e) => {
  closeAircraftCallout();
  closeDetails();

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
  if (selectedLat === null || selectedLon === null || !rangeSet) return;

  const radiusMeters = AircraftApiClient.nauticalMilesToMeters(rangeSet.value);

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
  if (selectedLat === null || selectedLon === null) {
    alert("Select location first");
    return;
  }

  closeAircraftCallout();
  aircraftLayer.clearLayers();

  try {
    const client = new AircraftApiClient({ baseUrl: window.APP_CONFIG?.aircraftApiBase });
    const payload = await client.search(selectedLat, selectedLon, rangeSet.value);
    const aircraft = payload.aircraft;

    aircraft.forEach((plane) => {
      if (plane.lat == null || plane.lon == null) return;

      const marker = L.marker([plane.lat, plane.lon], {
        icon: planeIcon,
        rotationAngle: plane.heading || 0
      }).addTo(aircraftLayer);

      marker.on("click", () => openAircraftCallout(plane, marker));
    });

    const total = document.getElementById("total");
    const reportedTotal = Number.isFinite(payload.total) ? payload.total : aircraft.length;
    if (total) total.textContent = `${reportedTotal} in selected area`;
    showToast(`Loaded ${aircraft.length} aircraft`);

  } catch (err) {
    console.error("Aircraft search failed:", err.message);
    const total = document.getElementById("total");
    if (total) total.textContent = "Aircraft data unavailable";
    showToast(err.message || "Failed to load aircraft");
  }
}

// ================= ATC AIRCRAFT CALLOUT =================
function openAircraftCallout(plane, aircraftMarker) {
  closeAircraftCallout();

  const aircraftLatLng = aircraftMarker.getLatLng();
  const aircraftPoint = map.latLngToContainerPoint(aircraftLatLng);
  const mapSize = map.getSize();
  const calloutPoint = L.point(
    Math.max(12, Math.min(mapSize.x - 248, aircraftPoint.x + 42)),
    Math.max(42, Math.min(mapSize.y - 42, aircraftPoint.y - 46))
  );
  const calloutLatLng = map.containerPointToLatLng(calloutPoint);

  const leader = L.polyline([aircraftLatLng, calloutLatLng], {
    color: "#36b8ff",
    weight: 2,
    opacity: 0.95,
    dashArray: "5 5",
    className: "atc-leader-line",
    interactive: false
  }).addTo(aircraftLayer);

  const altitude = plane.baroAltitude ?? "N/A";
  const callout = L.marker(calloutLatLng, {
    draggable: true,
    keyboard: false,
    riseOnHover: true,
    zIndexOffset: 1200,
    icon: L.divIcon({
      className: "atc-callout-icon",
      iconSize: [236, 76],
      iconAnchor: [0, 38],
      html: `
        <section class="atc-callout" aria-label="Aircraft ${escapeHtml(plane.markerLabel)}">
          <div class="atc-callout__readout">
            <span class="atc-callout__eyebrow"><i></i> LIVE TRACK</span>
            <div class="atc-callout__flightinfo">
              <strong class="atc-callout__callsign">${escapeHtml(plane.markerLabel)}</strong>
              <span class="atc-callout__altitude">ALT <b>${escapeHtml(altitude)}${typeof altitude === "number" ? " FT" : ""}</b></span>
            </div>
          </div>
          <button class="atc-callout__details" type="button" aria-label="View aircraft details">
            <span class="atc-callout__details-icon"><i class="bi bi-arrow-up-right"></i></span>
            <span>DETAILS</span>
          </button>
        </section>
      `
    })
  });

  callout.on("drag", () => {
    leader.setLatLngs([aircraftMarker.getLatLng(), callout.getLatLng()]);
  });
  const bindCalloutControls = () => {
    const element = callout.getElement();
    if (!element) return;
    element.addEventListener("click", event => event.stopPropagation());
    const detailsButton = element.querySelector(".atc-callout__details");
    if (!detailsButton || detailsButton.dataset.bound === "true") return;
    detailsButton.dataset.bound = "true";
    const stopDrag = event => event.stopPropagation();
    detailsButton.addEventListener("pointerdown", stopDrag);
    detailsButton.addEventListener("mousedown", stopDrag);
    detailsButton.addEventListener("touchstart", stopDrag, { passive: true });
    detailsButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openDetails(plane);
    });
  };
  callout.on("add", bindCalloutControls);
  callout.addTo(aircraftLayer);

  activeAircraftCallout = { callout, leader, plane };
}

function closeAircraftCallout() {
  if (!activeAircraftCallout) return;
  aircraftLayer.removeLayer(activeAircraftCallout.callout);
  aircraftLayer.removeLayer(activeAircraftCallout.leader);
  activeAircraftCallout = null;
}

// ================= AIRCRAFT DETAILS =================
function openDetails(plane) {
  const details = document.getElementById("aircraftDetails");
  const content = document.getElementById("detailsContent");
  if (!details || !content) {
    showToast("Aircraft details panel is unavailable. Refresh the page and try again.");
    return;
  }
  const fields = [
    ["ICAO", plane.icao || "N/A", "bi-upc-scan"],
    ["Registration", plane.reg || "N/A", "bi-card-text"],
    ["Aircraft type", plane.type || "Unknown", "bi-airplane"],
    ["Altitude", `${plane.baroAltitude ?? "N/A"}${typeof plane.baroAltitude === "number" ? " ft" : ""}`, "bi-arrows-vertical"],
    ["Ground speed", `${plane.speed ?? "N/A"}${plane.speed == null ? "" : " kt"}`, "bi-speedometer2"],
    ["Track", `${plane.heading ?? "N/A"}${plane.heading == null ? "" : "°"}`, "bi-compass"]
  ];

  const title = document.getElementById("detailsTitle");
  const subtitle = document.getElementById("detailsSubtitle");
  if (title) title.textContent = plane.markerLabel || "Aircraft details";
  if (subtitle) {
    subtitle.textContent = [plane.type, plane.reg || plane.icao]
      .filter(Boolean).join(" · ") || "Live aircraft information";
  }
  content.innerHTML = fields.map(([label, value, icon]) => `
    <div class="aircraft-detail">
      <span class="aircraft-detail__icon"><i class="bi ${icon}"></i></span>
      <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
    </div>
  `).join("");

  previouslyFocusedElement = document.activeElement;
  details.classList.remove("hidden");
  details.setAttribute("aria-hidden", "false");
  details.querySelector(".aircraft-details__close, .close")?.focus();
}

function closeDetails() {
  const details = document.getElementById("aircraftDetails");
  if (!details || details.classList.contains("hidden")) return;
  details.classList.add("hidden");
  details.setAttribute("aria-hidden", "true");
  previouslyFocusedElement?.focus?.();
  previouslyFocusedElement = null;
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
