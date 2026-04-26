// ================= TOKEN HELPERS =================
function getToken() {
  return localStorage.getItem("token");
}

function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));

    // CHECK EXPIRATION
    if (payload.exp * 1000 < Date.now()) {
      logout();
      return null;
    }

    return payload.username;
  } catch {
    return null;
  }
}

// reusable auth header
function authHeader() {
  return {
    "Authorization": "Bearer " + getToken()
  };
}

// ================= AUTH UI HELPERS =================

// Toggle password visibility
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("bi-eye", "bi-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("bi-eye-slash", "bi-eye");
  }
}

// ================= LOGIN =================
async function login() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!username || !password) {
    showLoginError("Please fill all fields");
    return;
  }

  try {
    const res = await fetch("https://web-app-p5sr.onrender.com/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showLoginError(data.message);
      return;
    }

    localStorage.setItem("token", data.token);

    showToast("Logged in successfully");

    closeModal("loginModal");
    clearLoginForm();
    renderAuthUI();

  } catch (err) {
    console.error(err);
    showLoginError("Server error");
  }
}

// ================= SIGNUP =================
async function signup() {
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value.trim();

  if (!username || !password) {
    showSignupError("Please fill all fields");
    return;
  }

  try {
    const res = await fetch("https://web-app-p5sr.onrender.com/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const msg = await res.text();
      showSignupError(msg);
      return;
    }

    // auto login after signup
    await loginAfterSignup(username, password);

  } catch (err) {
    console.error(err);
    showSignupError("Server error");
  }
}

// ================= AUTO LOGIN AFTER SIGNUP =================
async function loginAfterSignup(username, password) {
  const res = await fetch("https://web-app-p5sr.onrender.com/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (!res.ok) {
    showSignupError("Signup worked, but login failed");
    return;
  }

  localStorage.setItem("token", data.token);

  showToast("Account created & logged in 🎉");

  closeModal("signupModal");
  clearSignupForm();
  renderAuthUI();
}

// ================= LOGOUT =================
function logout() {
  localStorage.removeItem("token");

  renderAuthUI();
  showToast("Logged out");

  if (typeof toggleCreatePostVisibility === "function") {
    toggleCreatePostVisibility();
  }

  const actions = document.getElementById("postActions");
  if (actions) actions.innerHTML = "";
}

// ================= UI RENDER =================
function renderAuthUI() {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  const user = getUserFromToken();

  if (user) {
    authArea.innerHTML = `
      <span class="me-2 fw-semibold user-greeting">Hello, ${user}</span>
      <button class="btn btn-outline-danger btn-sm" onclick="logout()">Logout</button>
    `;
  } else {
    authArea.innerHTML = `
      <button class="btn btn-outline-primary btn-sm"
        data-bs-toggle="modal"
        data-bs-target="#loginModal">
        Login
      </button>

      <button class="btn btn-primary btn-sm"
        data-bs-toggle="modal"
        data-bs-target="#signupModal">
        Sign Up
      </button>
    `;
  }
}

// ================= FORM HELPERS =================
function closeModal(id) {
  const modalEl = document.getElementById(id);
  const modal = bootstrap.Modal.getInstance(modalEl);
  modal.hide();
}

function clearLoginForm() {
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
}

function clearSignupForm() {
  document.getElementById("signupUsername").value = "";
  document.getElementById("signupPassword").value = "";
}

// ================= ERROR HANDLING =================
function showLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = msg;
  el.classList.remove("d-none");
}

function showSignupError(msg) {
  const el = document.getElementById("signupError");
  el.textContent = msg;
  el.classList.remove("d-none");
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

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  renderAuthUI();
});