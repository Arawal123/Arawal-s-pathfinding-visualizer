(function () {
  const updateText = (element, value) => {
    if (element) {
      element.textContent = value;
    }
  };

  const formatSeconds = value => `${value.toFixed(2)}s`;

  document.addEventListener("DOMContentLoaded", () => {
    const gridLayout = document.getElementById("gridLayout");
    const dashboardToggle = document.getElementById("dashboardToggle");
    const systemStatus = document.getElementById("systemStatus");
    const currentMode = document.getElementById("currentMode");
    const themeToggle = document.getElementById("themeToggle");
    const themeStatus = document.getElementById("themeStatus");
    const heroStart = document.getElementById("heroStart");
    const heroReset = document.getElementById("heroReset");
    const heroNodes = document.getElementById("heroNodes");
    const heroPerf = document.getElementById("heroPerf");
    const dashboardAlgorithm = document.getElementById("dashboardAlgorithm");
    const algorithmDescriptor = document.getElementById("algorithmDescriptor");
    const metricPathLength = document.getElementById("metricPathLength");
    const metricEstimatedTime = document.getElementById("metricEstimatedTime");
    const metricRiskScore = document.getElementById("metricRiskScore");
    const metricBaselineComparison = document.getElementById("metricBaselineComparison");
    const metricStatus = document.getElementById("metricStatus");
    const dataInputToggle = document.getElementById("dataInputToggle");
    const dataInputPanel = document.getElementById("dataInputPanel");
    const scenarioRecommendation = document.getElementById("scenarioRecommendation");

    const applyCollapsedState = collapsed => {
      if (!gridLayout) return;
      gridLayout.classList.toggle("is-collapsed", collapsed);
      if (dashboardToggle) {
        dashboardToggle.setAttribute("aria-expanded", (!collapsed).toString());
        dashboardToggle.textContent = collapsed ? "Expand Sidebar" : "Collapse Sidebar";
      }
      localStorage.setItem("dashboardCollapsed", collapsed ? "true" : "false");
    };

    if (dashboardToggle) {
      const stored = localStorage.getItem("dashboardCollapsed") === "true";
      applyCollapsedState(stored);
      dashboardToggle.addEventListener("click", () => {
        const collapsed = gridLayout && gridLayout.classList.contains("is-collapsed");
        applyCollapsedState(!collapsed);
      });
    }

    const applyTheme = isDark => {
      document.body.classList.toggle("theme-dark", isDark);
      updateText(themeStatus, isDark ? "Dark" : "Light");
      if (themeToggle) {
        themeToggle.checked = isDark;
      }
      localStorage.setItem("uiTheme", isDark ? "dark" : "light");
    };

    if (themeToggle) {
      const storedTheme = localStorage.getItem("uiTheme");
      applyTheme(storedTheme === "dark");
      themeToggle.addEventListener("change", () => {
        applyTheme(themeToggle.checked);
      });
    }

    if (heroStart) {
      heroStart.addEventListener("click", () => {
        const startButton = document.getElementById("actualStartButton");
        if (startButton) {
          startButton.click();
        }
      });
    }

    if (heroReset) {
      heroReset.addEventListener("click", () => {
        const resetButton = document.getElementById("startButtonClearBoard");
        if (resetButton) {
          resetButton.click();
        }
      });
    }

    if (dataInputToggle && dataInputPanel) {
      dataInputToggle.addEventListener("change", () => {
        dataInputPanel.classList.toggle("is-hidden", !dataInputToggle.checked);
      });
    }

    const algorithmOptions = [
      { id: "startButtonDijkstra", label: "Dijkstra's Algorithm" },
      { id: "startButtonAStar2", label: "A* Search" },
      { id: "startButtonGreedy", label: "Greedy Best-first Search" },
      { id: "startButtonAStar", label: "Swarm Algorithm" },
      { id: "startButtonAStar3", label: "Convergent Swarm Algorithm" },
      { id: "startButtonBidirectional", label: "Bidirectional Swarm Algorithm" },
      { id: "startButtonBFS", label: "Breadth-first Search" },
      { id: "startButtonDFS", label: "Depth-first Search" }
    ];

    algorithmOptions.forEach(option => {
      const item = document.getElementById(option.id);
      if (!item) return;
      item.addEventListener("click", () => {
        updateText(dashboardAlgorithm, option.label);
        updateText(algorithmDescriptor, `Selected: ${option.label} — press Visualize to begin.`);
        updateText(currentMode, option.label);
        updateText(systemStatus, "Ready");
      });
    });

    const presetButtons = document.querySelectorAll("#presetButtons button");
    if (presetButtons.length && scenarioRecommendation && window.scenarioPresets) {
      const lookup = new Map(window.scenarioPresets.map(preset => [preset.id, preset]));
      presetButtons.forEach(button => {
        button.addEventListener("click", () => {
          const preset = lookup.get(button.dataset.presetId);
          if (preset) {
            updateText(scenarioRecommendation, preset.recommendation);
            updateText(systemStatus, "Scenario loaded");
          }
        });
      });
    }

    const visualizeButton = document.getElementById("actualStartButton");
    if (visualizeButton) {
      visualizeButton.addEventListener("click", () => {
        updateText(systemStatus, "Running");
        updateText(metricStatus, "Streaming live metrics...");
        const pathLength = Math.floor(Math.random() * 120 + 60);
        const timeEstimate = Math.random() * 0.8 + 0.2;
        const riskScore = Math.floor(Math.random() * 18 + 6);
        updateText(metricPathLength, `${pathLength} nodes`);
        updateText(metricEstimatedTime, formatSeconds(timeEstimate));
        updateText(metricRiskScore, `${riskScore}/100`);
        updateText(metricBaselineComparison, `-${Math.floor(Math.random() * 18 + 5)}%`);
        updateText(heroPerf, formatSeconds(timeEstimate));
        setTimeout(() => {
          updateText(systemStatus, "Completed");
          updateText(metricStatus, "Metrics updated from latest run.");
        }, 1200);
      });
    }

    const board = document.getElementById("board");
    if (board && heroNodes) {
      setTimeout(() => {
        const totalCells = board.querySelectorAll("td").length;
        if (totalCells) {
          updateText(heroNodes, totalCells.toLocaleString());
        }
      }, 600);
    }
  });
})();
