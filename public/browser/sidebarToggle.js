(function () {
  const gridLayout = document.getElementById("gridLayout");
  const toggleButton = document.getElementById("dashboardToggle");

  if (!gridLayout || !toggleButton) {
    return;
  }

  const setCollapsed = collapsed => {
    gridLayout.classList.toggle("is-collapsed", collapsed);
    toggleButton.setAttribute("aria-expanded", (!collapsed).toString());
    toggleButton.textContent = collapsed ? "Expand Sidebar" : "Collapse Sidebar";
  };

  toggleButton.addEventListener("click", () => {
    setCollapsed(!gridLayout.classList.contains("is-collapsed"));
  });
})();
