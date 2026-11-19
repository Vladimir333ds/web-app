const BASE_URL = window.API_BASE;

// ================= TOKEN HELPERS =================
function getToken() {
  return localStorage.getItem("token");
}

function getUsernameFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.username;
  } catch {
    return null;
  }
}

// ================= NAVIGATION =================
function showSection(section, el) {
  document.getElementById("section-profile").classList.add("d-none");
  document.getElementById("section-posts").classList.add("d-none");
  document.getElementById("section-comments").classList.add("d-none");

  document.querySelectorAll(".list-group-item").forEach(btn => {
    btn.classList.remove("active");
  });

  document.getElementById(`section-${section}`).classList.remove("d-none");
  el.classList.add("active");

  if (section === "posts") loadMyPosts();
  if (section === "comments") loadMyComments();
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();

  if (!token) {
    alert("Please login first");
    window.location.href = "blog.html";
    return;
  }

  const username = getUsernameFromToken();
  document.getElementById("profileUsername").textContent = username;

  loadProfileStats();
});

// ================= POSTS =================


async function loadMyPosts() {
  const username = getUsernameFromToken();

  const res = await fetch(apiUrl("blog-posts"));
  const posts = await res.json();

  const myPosts = posts.filter(p => p.author === username);

  const container = document.getElementById("myPosts");

  if (!myPosts.length) {
    container.innerHTML = "<p>No posts yet</p>";
    return;
  }

container.innerHTML = myPosts.map(p => `
  <div onclick="openMyPost(${p.id})"style="cursor:pointer; flex:1;" class="card p-3 mb-3 shadow-sm d-flex justify-content-between align-items-start">

    <div>
      <h5>${escapeHtml(p.title)}</h5>
      <p class="mb-1">${escapeHtml(p.content.substring(0, 100))}...</p>
      <small>Click to view</small>
    </div>

    <div class="d-flex gap-2 mt-1 flex-shrink-0">
      <button class="btn btn-warning btn-sm"
        onclick="event.stopPropagation(); openEditPost(${p.id})">
        <i class="bi bi-pencil"></i>
      </button>

      <button class="btn btn-danger btn-sm"
        onclick="event.stopPropagation(); deletePost(${p.id})">
        <i class="bi bi-trash"></i>
      </button>
    </div>

  </div>
`).join("");
}

async function openEditPost(postId) {
  const res = await fetch(apiUrl("blog-posts"));
  const posts = await res.json();

  const post = posts.find(p => p.id == postId);
  if (!post) return;

  currentEditPostId = post.id;

  document.getElementById("myPostTitle").textContent = post.title;
  document.getElementById("myPostContent").innerHTML =
    escapeHtml(post.content).replace(/\n/g, "<br>");

  document.getElementById("editTitle").value = post.title;
  document.getElementById("editContent").value = post.content;

  document.getElementById("editPostSection").classList.remove("d-none");

  new bootstrap.Modal(document.getElementById("myPostModal")).show();
}

// ================= COMMENTS =================
async function openPostFromComment(postId, commentId) {
  try {
    const [postsRes, commentsRes] = await Promise.all([
      fetch(apiUrl("blog-posts")),
      fetch(apiUrl("comments-all"))
    ]);

    const posts = await postsRes.json();
    const comments = await commentsRes.json();

    const post = posts.find(p => p.id == postId);
    const comment = comments.find(c => c.id == commentId);

    if (!post || !comment) {
      alert("Data not found");
      return;
    }

    document.getElementById("modalPostTitle").textContent = post.title;

    document.getElementById("modalPostMeta").innerHTML = `
      <i class="bi bi-person-circle"></i> ${escapeHtml(post.author)}
      &nbsp; • &nbsp;
      <i class="bi bi-tag"></i> ${escapeHtml(post.category)}
    `;

    document.getElementById("modalPostContent").innerHTML =
      escapeHtml(post.content).replace(/\n/g, "<br>");

    document.getElementById("modalUserComment").textContent = comment.content;

    new bootstrap.Modal(document.getElementById("viewPostModal")).show();

  } catch (err) {
    console.error(err);
  }
}

async function loadMyComments() {
  const username = getUsernameFromToken();

  const res = await fetch(apiUrl("comments-all"));
  const comments = await res.json();

  const myComments = comments.filter(c => c.author === username);

  const container = document.getElementById("myComments");

  if (!myComments.length) {
    container.innerHTML = "<p>No comments yet</p>";
    return;
  }

  container.innerHTML = myComments.map(c => `
    <div class="card comment-card mb-3 shadow-sm d-flex flex-row align-items-center justify-content-between">

      <div onclick="openPostFromComment(${c.post_id}, ${c.id})"
          style="cursor:pointer; flex:1;">
        <p class="mb-1">${escapeHtml(c.content)}</p>
        <small>Click to view post</small>
      </div>

      <button class="btn btn-danger btn-sm ms-3 flex-shrink-0"
        onclick="event.stopPropagation(); deleteComment(${c.id})">
        <i class="bi bi-trash"></i>
      </button>

    </div>
  `).join("");
}

// ================= DELETE COMMENT =================
async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;

  const res = await fetch(apiUrl(`delete-comment/${commentId}`), {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + getToken()
    }
  });

  if (!res.ok) return alert("Failed");

  loadMyComments();
}

// ================= POSTS MODAL =================
let currentEditPostId = null;

async function openMyPost(postId) {
  const res = await fetch(apiUrl("blog-posts"));
  const posts = await res.json();

  const post = posts.find(p => p.id == postId);
  if (!post) return;

  currentEditPostId = post.id;

  document.getElementById("myPostTitle").textContent = post.title;
  document.getElementById("myPostContent").innerHTML =
    escapeHtml(post.content).replace(/\n/g, "<br>");

  document.getElementById("editTitle").value = post.title;
  document.getElementById("editContent").value = post.content;

  new bootstrap.Modal(document.getElementById("myPostModal")).show();
}

function toggleEdit() {
  document.getElementById("editPostSection").classList.toggle("d-none");
}

// ================= EDIT POST =================
async function saveEdit() {
  const title = document.getElementById("editTitle").value.trim();
  const content = document.getElementById("editContent").value.trim();

  const res = await fetch(apiUrl(`edit-post/${currentEditPostId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getToken()
    },
    body: JSON.stringify({ title, content })
  });

  if (!res.ok) return alert("Failed");

  bootstrap.Modal.getInstance(document.getElementById("myPostModal")).hide();
  loadMyPosts();
}

// ================= DELETE POST =================
async function deletePost(postId) {
  if (!confirm("Delete post?")) return;

  const res = await fetch(apiUrl(`delete-post/${postId}`), {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + getToken()
    }
  });

  if (!res.ok) return alert("Failed");

  bootstrap.Modal.getInstance(document.getElementById("myPostModal")).hide();
  loadMyPosts();
}

// ================= PROFILE STATS =================
async function loadProfileStats() {
  const username = getUsernameFromToken();

  const [postsRes, commentsRes, userRes] = await Promise.all([
    fetch(apiUrl("blog-posts")),
    fetch(apiUrl("comments-all")),
    fetch(apiUrl("me"), {
      headers: { "Authorization": "Bearer " + getToken() }
    })
  ]);

  const posts = await postsRes.json();
  const comments = await commentsRes.json();
  const user = await userRes.json();

  document.getElementById("profilePosts").textContent =
    posts.filter(p => p.author === username).length;

  document.getElementById("profileComments").textContent =
    comments.filter(c => c.author === username).length;

  document.getElementById("profileCreated").textContent =
    new Date(user.created_at).toLocaleDateString();
}

// ================= USERNAME CHANGE =================
async function submitUsernameChange() {
  const newUsername = document.getElementById("newUsernameInput").value.trim();

  const res = await fetch(apiUrl("edit-username"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getToken()
    },
    body: JSON.stringify({ newUsername })
  });

  const data = await res.json();

  alert("Username updated. Please login again.");

  localStorage.removeItem("token");
  location.reload();
}

// ================= PASSWORD CHANGE =================
async function submitPasswordChange() {
  const currentPassword = document.getElementById("currentPasswordInput").value;
  const newPassword = document.getElementById("newPasswordInput").value;

  const res = await fetch(apiUrl("edit-password"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getToken()
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  if (!res.ok) return alert("Failed");

  alert("Password updated");

  localStorage.removeItem("token");
  location.reload();
}

// ================= DELETE ACCOUNT =================
async function deleteAccount() {
  if (!confirm("Delete account permanently?")) return;

  const res = await fetch(apiUrl("delete-account"), {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + getToken()
    }
  });

  if (!res.ok) return alert("Failed");

  localStorage.removeItem("token");
  window.location.href = "../index.html";
}
