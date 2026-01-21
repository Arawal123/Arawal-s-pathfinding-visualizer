(function () {
  const buildFloodEvacuation = (height, width) => {
    const blockedNodes = [];
    const weightedNodes = [];
    const floodStart = Math.floor(height * 0.55);
    for (let r = floodStart; r < height; r += 2) {
      for (let c = 2; c < width - 2; c++) {
        blockedNodes.push(`${r}-${c}`);
      }
    }
    const corridorColumn = Math.floor(width * 0.6);
    for (let r = Math.floor(height * 0.15); r < Math.floor(height * 0.5); r++) {
      weightedNodes.push({ id: `${r}-${corridorColumn}`, weight: 15 });
      if (r % 2 === 0 && corridorColumn + 1 < width - 1) {
        weightedNodes.push({ id: `${r}-${corridorColumn + 1}`, weight: 15 });
      }
    }
    return {
      blockedNodes,
      weightedNodes,
      recommendation: "Prioritize A* Search for hazard-aware evacuation routes."
    };
  };

  const buildEmergencyResponse = (height, width) => {
    const blockedNodes = [];
    const weightedNodes = [];
    const midRow = Math.floor(height * 0.5);
    const midCol = Math.floor(width * 0.45);
    for (let c = 2; c < width - 2; c++) {
      if (c % 3 === 0) {
        blockedNodes.push(`${midRow}-${c}`);
      }
    }
    for (let r = 2; r < height - 2; r++) {
      if (r % 4 === 0) {
        blockedNodes.push(`${r}-${midCol}`);
      }
      if (r % 3 === 0) {
        weightedNodes.push({ id: `${r}-${midCol + 3}`, weight: 15 });
      }
    }
    return {
      blockedNodes,
      weightedNodes,
      recommendation: "Use Dijkstra's Algorithm to balance speed and weighted delays."
    };
  };

  const buildAccessibilityRouting = (height, width) => {
    const blockedNodes = [];
    const weightedNodes = [];
    const gentleLane = Math.floor(width * 0.35);
    for (let r = 2; r < height - 2; r++) {
      if (r % 5 === 0) {
        blockedNodes.push(`${r}-${gentleLane - 1}`);
      }
      if (r % 2 === 1) {
        weightedNodes.push({ id: `${r}-${gentleLane}`, weight: 15 });
      }
      if (r % 3 === 0 && gentleLane + 2 < width - 2) {
        weightedNodes.push({ id: `${r}-${gentleLane + 2}`, weight: 15 });
      }
    }
    return {
      blockedNodes,
      weightedNodes,
      recommendation: "Select Swarm or A* to favor consistent accessibility paths."
    };
  };

  window.scenarioPresets = [
    {
      id: "flood-evacuation",
      label: "Flood Evacuation",
      build: buildFloodEvacuation
    },
    {
      id: "emergency-response",
      label: "Emergency Response",
      build: buildEmergencyResponse
    },
    {
      id: "accessibility-routing",
      label: "Accessibility Routing",
      build: buildAccessibilityRouting
    }
  ];
})();
