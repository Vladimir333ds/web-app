fetch("https://api.example.com/user/123")
  .then(response => response.json())
  .then(data => {
    document.getElementById("reg").textContent = data.name;
    document.getElementById("type").textContent = data.email;
  })
  .catch(error => {
    console.error("Error fetching data:", error);
  });