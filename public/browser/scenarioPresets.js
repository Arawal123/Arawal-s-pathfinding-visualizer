(function () {
  const addRectangle = (blockedNodes, top, left, bottom, right) => {
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        blockedNodes.push(`${r}-${c}`);
      }
    }
  };

  const addWeightedRing = (weightedNodes, top, left, bottom, right, weight = 15) => {
    for (let c = left; c <= right; c++) {
      weightedNodes.push({ id: `${top}-${c}`, weight });
      weightedNodes.push({ id: `${bottom}-${c}`, weight });
    }
    for (let r = top; r <= bottom; r++) {
      weightedNodes.push({ id: `${r}-${left}`, weight });
      weightedNodes.push({ id: `${r}-${right}`, weight });
    }
  };

  const buildFloodEvacuation = (height, width) => {
    const blockedNodes = [];
    const weightedNodes = [];
    const floodStart = Math.floor(height * 0.55);
    const corridorLeft = Math.max(2, Math.floor(width * 0.25));
    const corridorRight = Math.min(width - 3, Math.floor(width * 0.75));

    for (let r = floodStart; r < height; r++) {
      for (let c = 2; c < width - 2; c++) {
        if (c === corridorLeft || c === corridorRight) continue;
        if (r % 2 === 0 || c % 6 === 0) {
          blockedNodes.push(`${r}-${c}`);
        }
      }
    }

    for (let r = floodStart - 3; r < height; r++) {
      weightedNodes.push({ id: `${r}-${corridorLeft}`, weight: 15 });
      weightedNodes.push({ id: `${r}-${corridorRight}`, weight: 15 });
      if (r % 2 === 0 && corridorLeft + 1 < width - 2) {
        weightedNodes.push({ id: `${r}-${corridorLeft + 1}`, weight: 15 });
      }
      if (r % 3 === 0 && corridorRight - 1 > 1) {
        weightedNodes.push({ id: `${r}-${corridorRight - 1}`, weight: 15 });
      }
    }

    for (let r = floodStart - 2; r <= floodStart + 2; r++) {
      for (let c = 2; c < width - 2; c += 2) {
        weightedNodes.push({ id: `${r}-${c}`, weight: 15 });
      }
    }

    const debrisTop = floodStart + 2;
    addRectangle(
      blockedNodes,
      debrisTop,
      Math.floor(width * 0.42),
      Math.min(height - 3, debrisTop + 3),
      Math.floor(width * 0.55)
    );
    addRectangle(
      blockedNodes,
      floodStart + 6,
      Math.floor(width * 0.1),
      Math.min(height - 3, floodStart + 8),
      Math.floor(width * 0.2)
    );

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
    const midCol = Math.floor(width * 0.5);

    for (let r = 4; r < height - 4; r += 4) {
      for (let c = 2; c < width - 2; c++) {
        if (c % 7 !== 0) {
          blockedNodes.push(`${r}-${c}`);
        }
      }
    }

    for (let c = 6; c < width - 6; c += 6) {
      for (let r = 2; r < height - 2; r++) {
        if (r % 5 !== 0) {
          blockedNodes.push(`${r}-${c}`);
        }
      }
    }

    addRectangle(
      blockedNodes,
      Math.max(2, midRow - 2),
      Math.max(2, midCol - 3),
      Math.min(height - 3, midRow + 2),
      Math.min(width - 3, midCol + 3)
    );
    addWeightedRing(
      weightedNodes,
      Math.max(2, midRow - 3),
      Math.max(2, midCol - 4),
      Math.min(height - 3, midRow + 3),
      Math.min(width - 3, midCol + 4)
    );

    for (let c = 2; c < width - 2; c += 2) {
      weightedNodes.push({ id: `${Math.floor(height * 0.2)}-${c}`, weight: 15 });
      weightedNodes.push({ id: `${Math.floor(height * 0.8)}-${c}`, weight: 15 });
    }

    for (let r = 2; r < height - 2; r += 2) {
      weightedNodes.push({ id: `${r}-${Math.floor(width * 0.2)}`, weight: 15 });
      weightedNodes.push({ id: `${r}-${Math.floor(width * 0.8)}`, weight: 15 });
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
