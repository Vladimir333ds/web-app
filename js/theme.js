// ================= THEME STATE =================
function applyTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

// ================= UI UPDATE =================
function updateIcon() {
  const btn = document.getElementById("darkToggle");
  if (!btn) return;

  btn.textContent =
    document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
}

// ================= TOGGLE =================
function toggleTheme() {
  document.body.classList.toggle("dark-mode");

  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");

  updateIcon();
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  applyTheme();
  updateIcon();

  const btn = document.getElementById("darkToggle");
  if (btn) {
    btn.onclick = toggleTheme;
  }
});