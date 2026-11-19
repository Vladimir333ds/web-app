// ================= CONFIG =================
const BASE_URL = window.API_BASE;

// ================= GLOBAL STATE =================
let allAircraft = [];
let currentCategory = "All";
let currentIndex = 0;
let currentList = [];

// ================= LOAD DATA =================
async function loadAircraft() {
  try {
    const res = await fetch(`${BASE_URL}/aircraft-gallery`);
    const data = await res.json();

    allAircraft = data;
    filterAircraft("All");

  } catch (err) {
    console.error("Failed to load aircraft:", err);
  }
}

// ================= DISPLAY =================
function displayAircraft(data) {
  currentList = data;

  const gallery = document.getElementById("gallery");

  if (data.length === 0) {
    gallery.innerHTML = `
      <div class="col-12 text-center">
        <div class="no-results">
          <i class="bi bi-airplane"></i> No aircraft found
        </div>
      </div>
    `;
    return;
  }

  gallery.innerHTML = data.map((plane, index) => `
    <div class="col-12 col-sm-6 col-md-4 col-lg-3">
      <div class="card h-100 shadow-sm clickable-card"
           onclick="openImageModal(${index})">

        <img src="${escapeHtml(BASE_URL + plane.image_url)}"
             class="card-img-top" 
             alt="${escapeHtml(plane.name)}">

        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${escapeHtml(plane.name)}</h5>
          <small class="mb-2 card-manufacturer">${escapeHtml(plane.manufacturer)}</small>
          <p class="card-text small flex-grow-1">${escapeHtml(plane.description)}</p>
          <span class="badge category-pill">${escapeHtml(plane.category)}</span>
        </div>

      </div>
    </div>
  `).join("");
}

// ================= MODAL =================
function openImageModal(index) {
  currentIndex = index;
  updateModal();

  new bootstrap.Modal(
    document.getElementById("imageModal")
  ).show();
}

function updateModal() {
  const plane = currentList[currentIndex];

  document.getElementById("modalImage").src =
    BASE_URL + plane.image_url;

  document.getElementById("modalCaption").textContent =
    plane.name;
}

function nextImage() {
  currentIndex = (currentIndex + 1) % currentList.length;
  updateModal();
}

function prevImage() {
  currentIndex = (currentIndex - 1 + currentList.length) % currentList.length;
  updateModal();
}

// ================= KEYBOARD NAVIGATION =================
document.addEventListener("keydown", (e) => {
  const modalOpen =
    document.getElementById("imageModal")?.classList.contains("show");

  if (!modalOpen) return;

  if (e.key === "ArrowRight") nextImage();
  if (e.key === "ArrowLeft") prevImage();
});

// ================= FILTER =================
function filterAircraft(category) {
  currentCategory = category;

  // Reset buttons
  document.querySelectorAll(".filter-btns button").forEach(btn => {
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-outline-primary");
  });

  // Activate selected button
  const activeBtn = [...document.querySelectorAll(".filter-btns button")]
    .find(btn => btn.dataset.category === category);

  if (activeBtn) {
    activeBtn.classList.remove("btn-outline-primary");
    activeBtn.classList.add("btn-primary");
  }

  applyFilters();
}

// ================= APPLY FILTERS =================
function applyFilters() {
  const searchInput = document.getElementById("searchInput");
  const searchValue = searchInput.value.toLowerCase();

  let filtered = allAircraft;

  // Category filter
  if (currentCategory !== "All") {
    filtered = filtered.filter(p => p.category === currentCategory);
  }

  // Search filter
  if (searchValue) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchValue) ||
      p.manufacturer.toLowerCase().includes(searchValue)
    );
  }

  displayAircraft(filtered);
}

// ================= SEARCH =================
function clearSearch() {
  const input = document.getElementById("searchInput");

  input.value = "";

  document.querySelector(".search-wrapper")
    ?.classList.remove("active");

  applyFilters();
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  loadAircraft();

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const wrapper = document.querySelector(".search-wrapper");

      if (searchInput.value) {
        wrapper.classList.add("active");
      } else {
        wrapper.classList.remove("active");
      }

      applyFilters();
    });
  }
});
