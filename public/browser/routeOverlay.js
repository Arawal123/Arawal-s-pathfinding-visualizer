const ROUTE_CLASSES = {
  recommended: "route-recommended",
  flood: "route-flood",
  delayed: "route-delayed"
};

const ROUTE_LABELS = {
  recommended: "Recommended Route",
  flood: "Flood Route",
  delayed: "Delayed Route"
};

function initializeRouteOverlay(board) {
  board.routeOverlayState = {
    routes: null,
    routeNodes: {},
    labels: {},
    showAlternatives: true
  };
  let toggle = document.getElementById("showAlternativeRoutes");
  if (toggle) {
    toggle.checked = true;
    toggle.onchange = () => {
      board.routeOverlayState.showAlternatives = toggle.checked;
      if (board.routeOverlayState.routes) {
        updateRouteOverlays(board, board.routeOverlayState.routes);
      }
      if (typeof board.onAlternativeRoutesToggle === "function") {
        board.onAlternativeRoutesToggle();
      }
    };
  }
  ensureLabelContainer(board);
}

function ensureLabelContainer(board) {
  let container = document.getElementById("routeLabelContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "routeLabelContainer";
    container.className = "route-label-container";
    let gridPanel = document.getElementById("gridPanel");
    if (gridPanel) {
      gridPanel.appendChild(container);
    }
  }
  Object.keys(ROUTE_CLASSES).forEach(key => {
    let label = container.querySelector(`[data-route-label="${key}"]`);
    if (!label) {
      label = document.createElement("div");
      label.dataset.routeLabel = key;
      label.className = `route-label ${ROUTE_CLASSES[key]}`;
      label.textContent = ROUTE_LABELS[key];
      container.appendChild(label);
    }
    board.routeOverlayState.labels[key] = label;
  });
}

function clearRouteOverlays(board) {
  if (!board.routeOverlayState) return;
  Object.keys(board.routeOverlayState.routeNodes).forEach(routeKey => {
    board.routeOverlayState.routeNodes[routeKey].forEach(nodeId => {
      let element = document.getElementById(nodeId);
      if (element) {
        element.classList.remove(ROUTE_CLASSES[routeKey]);
        element.classList.remove("route-highlight");
      }
    });
  });
  board.routeOverlayState.routeNodes = {};
  if (board.routeOverlayState.labels) {
    Object.values(board.routeOverlayState.labels).forEach(label => {
      label.style.opacity = "0";
    });
  }
}

function updateRouteOverlays(board, routes) {
  if (!board.routeOverlayState) return;
  clearRouteOverlays(board);
  board.routeOverlayState.routes = routes;
  let showAlternatives = board.routeOverlayState.showAlternatives !== false;
  let activeKeys = ["recommended"].concat(showAlternatives ? ["flood", "delayed"] : []);
  activeKeys.forEach(key => {
    let route = routes[key];
    if (!route || !route.ids.length) return;
    board.routeOverlayState.routeNodes[key] = route.ids.slice();
    route.ids.forEach(nodeId => {
      let element = document.getElementById(nodeId);
      if (element) {
        element.classList.add(ROUTE_CLASSES[key]);
      }
    });
    placeRouteLabel(board, key, route.ids[0]);
  });
  Object.keys(ROUTE_CLASSES).forEach(key => {
    if (!activeKeys.includes(key)) {
      let label = board.routeOverlayState.labels[key];
      if (label) {
        label.style.opacity = "0";
      }
    }
  });
}

function placeRouteLabel(board, routeKey, nodeId) {
  let label = board.routeOverlayState.labels[routeKey];
  let gridPanel = document.getElementById("gridPanel");
  if (!label || !gridPanel || !nodeId) return;
  let nodeElement = document.getElementById(nodeId);
  if (!nodeElement) return;
  let panelRect = gridPanel.getBoundingClientRect();
  let nodeRect = nodeElement.getBoundingClientRect();
  label.style.left = `${nodeRect.left - panelRect.left + 6}px`;
  label.style.top = `${nodeRect.top - panelRect.top - 22}px`;
  label.style.opacity = "1";
}

function highlightRoute(board, routeKey, isActive) {
  if (!board.routeOverlayState || !board.routeOverlayState.routeNodes[routeKey]) return;
  board.routeOverlayState.routeNodes[routeKey].forEach(nodeId => {
    let element = document.getElementById(nodeId);
    if (!element) return;
    if (isActive) {
      element.classList.add("route-highlight");
    } else {
      element.classList.remove("route-highlight");
    }
  });
}

function deriveAlternativeRoutes(baseIds, board) {
  let base = sanitizeRouteIds(baseIds);
  let used = new Set(base);
  let flood = buildOffsetRoute(base, board, {
    offsets: [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ],
    preferWeighted: true,
    avoid: used
  });
  flood.forEach(id => used.add(id));
  let delayed = buildOffsetRoute(base, board, {
    offsets: [
      [-1, 0],
      [0, -1],
      [1, 0],
      [0, 1]
    ],
    preferWeighted: false,
    avoid: used
  });
  delayed = insertDetours(delayed, board, used);
  return {
    recommended: { ids: base },
    flood: { ids: flood },
    delayed: { ids: delayed }
  };
}

function sanitizeRouteIds(ids) {
  let seen = new Set();
  return ids.filter(id => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildOffsetRoute(routeIds, board, options) {
  let { offsets, preferWeighted, avoid } = options;
  return routeIds.map((id, index) => {
    if (index === 0 || index === routeIds.length - 1) {
      return id;
    }
    let neighbor = selectNeighbor(id, offsets, board, avoid, preferWeighted);
    return neighbor || id;
  });
}

function selectNeighbor(id, offsets, board, avoid, preferWeighted) {
  let weightedCandidate = null;
  for (let [dr, dc] of offsets) {
    let neighbor = offsetId(id, dr, dc);
    if (!neighbor || !isWalkable(neighbor, board)) continue;
    if (avoid && avoid.has(neighbor)) continue;
    if (preferWeighted) {
      let node = board.nodes[neighbor];
      if (node && node.weight === 15) {
        return neighbor;
      }
      if (!weightedCandidate) weightedCandidate = neighbor;
    } else {
      return neighbor;
    }
  }
  return weightedCandidate;
}

function insertDetours(routeIds, board, avoid) {
  let detoured = [];
  for (let i = 0; i < routeIds.length; i++) {
    detoured.push(routeIds[i]);
    if (i === 0 || i >= routeIds.length - 1) continue;
    if (i % 4 !== 0) continue;
    let next = routeIds[i + 1];
    let detour = selectDetour(routeIds[i], next, board, avoid);
    if (detour) {
      detoured.push(detour);
    }
  }
  return detoured;
}

function selectDetour(current, next, board, avoid) {
  let offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (let [dr, dc] of offsets) {
    let candidate = offsetId(current, dr, dc);
    if (!candidate || !isWalkable(candidate, board)) continue;
    if (avoid && avoid.has(candidate)) continue;
    if (isAdjacent(candidate, next)) {
      return candidate;
    }
  }
  return null;
}

function isAdjacent(a, b) {
  let [ar, ac] = a.split("-").map(Number);
  let [br, bc] = b.split("-").map(Number);
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function offsetId(id, dr, dc) {
  let [r, c] = id.split("-").map(Number);
  if (Number.isNaN(r) || Number.isNaN(c)) return null;
  return `${r + dr}-${c + dc}`;
}

function isWalkable(id, board) {
  let node = board.nodes[id];
  return node && node.status !== "wall";
}

module.exports = {
  initializeRouteOverlay,
  updateRouteOverlays,
  clearRouteOverlays,
  deriveAlternativeRoutes,
  highlightRoute
};
