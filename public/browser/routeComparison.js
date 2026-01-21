const ROUTE_KEYS = ["recommended", "flood", "delayed"];

function initializeRouteComparison(board, highlightCallback) {
  ROUTE_KEYS.forEach(key => {
    let row = document.querySelector(`[data-route="${key}"]`);
    if (!row) return;
    row.onmouseenter = () => highlightCallback(key, true);
    row.onmouseleave = () => highlightCallback(key, false);
  });
  resetRouteComparison();
}

function updateRouteComparison(summaries, showAlternatives) {
  let showAlt = showAlternatives !== false;
  summaries.forEach(summary => {
    let row = document.querySelector(`[data-route="${summary.key}"]`);
    if (!row) return;
    let name = row.querySelector(".route-name");
    let delay = row.querySelector(".route-delay");
    let risk = row.querySelector(".route-risk");
    let access = row.querySelector(".route-access");
    if (name) name.textContent = summary.label;
    if (delay) delay.textContent = summary.delayText;
    if (risk) risk.textContent = summary.riskLabel;
    if (access) access.textContent = summary.accessibility;
    if (summary.key !== "recommended") {
      row.classList.toggle("is-hidden", !showAlt);
    }
  });
}

function resetRouteComparison() {
  ROUTE_KEYS.forEach(key => {
    let row = document.querySelector(`[data-route="${key}"]`);
    if (!row) return;
    let delay = row.querySelector(".route-delay");
    let risk = row.querySelector(".route-risk");
    let access = row.querySelector(".route-access");
    if (delay) delay.textContent = "--";
    if (risk) risk.textContent = "--";
    if (access) access.textContent = "--";
    if (key !== "recommended") {
      row.classList.add("is-hidden");
    }
  });
}

module.exports = {
  initializeRouteComparison,
  updateRouteComparison,
  resetRouteComparison
};
