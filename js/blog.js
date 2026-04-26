// ================= CONFIG =================
const BASE_URL = "http://localhost:3000";

let allPosts = [];
let currentPostId = null;

// ================= LOAD POSTS =================
async function loadPosts() {
  try {
    const res = await fetch(`${BASE_URL}/blog-posts`);
    const data = await res.json();

    allPosts = data;
    displayPosts(data);

  } catch (err) {
    console.error("Failed to load posts:", err);
  }
}

// ================= DISPLAY FEED =================
function displayPosts(posts) {
  const feed = document.getElementById("blogFeed");

  if (!posts.length) {
    feed.innerHTML = `
      <div class="text-center text-muted">
        <i class="bi bi-journal-x"></i> No posts found
      </div>
    `;
    return;
  }

  feed.innerHTML = posts.map((post, index) => `
    <div class="blog-card" onclick="openPost(${index})">
      
      <h5 class="blog-title">
        <i class="bi bi-file-text"></i> ${post.title}
      </h5>
      
      <div class="blog-meta">
        <span>
          <i class="bi bi-person-circle"></i> ${post.author}
        </span>

        <span class="badge">
          <i class="bi bi-tag"></i> ${post.category}
        </span>
      </div>

      <p class="blog-preview">
        ${post.content.substring(0, 120)}...
      </p>

    </div>
  `).join("");
}

// ================= OPEN POST =================
function openPost(index) {
  const post = allPosts[index];
  currentPostId = post.id;

  const currentUser = getUserFromToken();
  const actions = document.getElementById("postActions");

  // Post actions (owner only)
  if (currentUser === post.author) {
    actions.innerHTML = `
      <button class="btn btn-danger btn-sm" onclick="deletePost(${post.id})">
        <i class="bi bi-trash"></i> Delete
      </button>
    `;
  } else {
    actions.innerHTML = "";
  }

  // Populate modal content
  document.getElementById("postTitle").textContent = post.title;

  document.getElementById("postMeta").innerHTML = `
    <i class="bi bi-person-circle"></i> ${post.author}
    &nbsp; • &nbsp;
    <i class="bi bi-tag"></i> ${post.category}
  `;

  document.getElementById("postContent").innerHTML =
    post.content.replace(/\n/g, "<br>");

  // Handle image
  const img = document.getElementById("postImage");

  if (post.show_image && post.image_url) {
    img.src = BASE_URL + post.image_url;
    img.classList.remove("d-none");
  } else {
    img.classList.add("d-none");
  }

  // Load comments
  loadComments(post.id);

  new bootstrap.Modal(document.getElementById("postModal")).show();
}

// ================= CREATE POST VISIBILITY =================
function toggleCreatePostVisibility() {
  const section = document.getElementById("createPostSection");
  const user = getUserFromToken();

  if (!section) return;

  section.classList.toggle("d-none", !user);
}

// ================= LOAD COMMENTS =================
async function loadComments(postId) {
  try {
    const res = await fetch(`${BASE_URL}/comments/${postId}`);
    const comments = await res.json();

    const container = document.getElementById("commentsList");

    if (!comments.length) {
      container.innerHTML = `<p>No comments yet</p>`;
      return;
    }

    const currentUser = getUserFromToken();

    container.innerHTML = comments.map(c => {
      const formatted = timeAgo(c.created_at);
      const isOwner = currentUser === c.author;

      return `
        <div class="comment mb-2 p-2 d-flex justify-content-between align-items-start">

          <div>
            <strong>${c.author}</strong>
            <p class="mb-1">${c.content}</p>

            ${isOwner ? `
              <button class="btn btn-sm btn-danger mt-1"
                onclick="deleteComment(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            ` : ""}
          </div>

          <small class="text-nowrap ms-2">
            ${formatted}
          </small>

        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Failed to load comments:", err);
  }
}

// ================= TIME FORMAT =================
function timeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diff = Math.floor((now - past) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return `${Math.floor(diff / 86400)}d ago`;
}

// ================= ADD COMMENT =================
async function addComment() {
  const input = document.getElementById("commentInput");
  const content = input.value.trim();

  if (!content) return;

  try {
    const res = await fetch(`${BASE_URL}/add-comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
      },
      body: JSON.stringify({
        post_id: currentPostId,
        content
      })
    });

    if (!res.ok) {
      alert("Login required");
      return;
    }

    input.value = "";
    loadComments(currentPostId);

  } catch (err) {
    console.error("Failed to add comment:", err);
  }
}

// ================= CREATE POST =================
async function createPost() {
  const title = document.getElementById("postTitleInput").value.trim();
  const content = document.getElementById("postContentInput").value.trim();

  if (!title || !content) return;

  try {
    const res = await fetch(`${BASE_URL}/create-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
      },
      body: JSON.stringify({ title, content })
    });

    if (!res.ok) {
      alert("Failed to create post");
      return;
    }

    // Clear inputs
    document.getElementById("postTitleInput").value = "";
    document.getElementById("postContentInput").value = "";

    loadPosts();
    showToast("Post created");

  } catch (err) {
    console.error("Failed to create post:", err);
  }
}

// ================= DELETE POST =================
async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;

  try {
    const res = await fetch(`${BASE_URL}/delete-post/${postId}`, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + getToken()
      }
    });

    if (!res.ok) {
      alert("Failed to delete post");
      return;
    }

    bootstrap.Modal.getInstance(document.getElementById("postModal")).hide();
    loadPosts();

  } catch (err) {
    console.error("Delete error:", err);
  }
}

// ================= DELETE COMMENT =================
async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;

  try {
    const res = await fetch(`${BASE_URL}/delete-comment/${commentId}`, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + getToken()
      }
    });

    if (!res.ok) {
      alert("Failed to delete comment");
      return;
    }

    loadComments(currentPostId);

  } catch (err) {
    console.error("Delete comment failed:", err);
  }
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  loadPosts();
  toggleCreatePostVisibility();
});