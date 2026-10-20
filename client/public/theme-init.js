// Runs before application styles and React. Keep this preference contract in sync with themeStore.
(() => {
  let preference = "system";
  try {
    preference = localStorage.getItem("prakash-venue-theme") || "system";
  } catch {
    /* Appearance also works without storage. */
  }
  const dark =
    preference === "dark" ||
    (preference !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // The server can provide the venue's saved appearance before any data request.
  // This hint never changes the dashboard preference in localStorage.
  const publicPreference =
    document.querySelector?.('meta[name="venue-appearance"]')?.content ||
    document.documentElement.dataset.websiteAppearance;
  if (["light", "dark", "system"].includes(publicPreference)) {
    const publicDark =
      publicPreference === "dark" ||
      (publicPreference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.publicAppearance = publicDark ? "dark" : "light";
  }
  document.documentElement.style.colorScheme =
    document.documentElement.dataset.publicAppearance || (dark ? "dark" : "light");
})();
