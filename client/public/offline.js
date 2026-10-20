const retry = document.getElementById("retry-connection");
const status = document.getElementById("connection-status");

retry.addEventListener("click", () => {
  // Reload the originally requested owner URL. The service worker fetches a
  // fresh document and falls back here again if the connection still fails.
  window.location.reload();
});

const updateStatus = () => {
  status.textContent = navigator.onLine
    ? "Connection may be available. Select Retry connection to continue."
    : "Waiting for an internet connection.";
};

window.addEventListener("online", updateStatus);
window.addEventListener("offline", updateStatus);
updateStatus();
