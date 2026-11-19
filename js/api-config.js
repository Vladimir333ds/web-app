// Browser API calls go to the local Node process in local development and to
// the deployed Render service when the site is opened from another host.
window.API_BASE = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000"
  : "https://web-app-p5sr.onrender.com";

window.apiUrl = path => `${window.API_BASE}/${String(path).replace(/^\/+/, "")}`;
