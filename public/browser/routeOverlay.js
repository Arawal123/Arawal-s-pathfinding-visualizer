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

const ROUTE_COLORS = {
  recommended: "#facc15",
  flood: "#ef4444",
  delayed: "#f97316"
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
        element.classList.remove("route-cell");
        element.style.boxShadow = "";
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
  let nodeRouteMap = new Map();
  activeKeys.forEach(key => {
    let route = routes[key];
    if (!route || !route.ids.length) return;
    board.routeOverlayState.routeNodes[key] = route.ids.slice();
    route.ids.forEach(nodeId => {
      let element = document.getElementById(nodeId);
      if (element) {
        element.classList.add(ROUTE_CLASSES[key]);
        element.classList.add("route-cell");
        if (!nodeRouteMap.has(nodeId)) {
          nodeRouteMap.set(nodeId, []);
        }
        nodeRouteMap.get(nodeId).push(key);
      }
    });
    placeRouteLabel(board, key, route.ids[0]);
  });
  nodeRouteMap.forEach((keys, nodeId) => {
    let element = document.getElementById(nodeId);
    if (!element) return;
    element.style.boxShadow = buildRouteShadow(keys);
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
  let flood = buildParallelRoute(base, board, 1);
  flood = injectDetours(flood, board, 1, 3);
  let delayed = buildParallelRoute(base, board, -1);
  delayed = injectDetours(delayed, board, -1, 4);
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

function buildParallelRoute(routeIds, board, side) {
  if (routeIds.length < 3) return routeIds.slice();
  let result = [];
  for (let i = 0; i < routeIds.length; i++) {
    let id = routeIds[i];
    if (i === 0 || i === routeIds.length - 1) {
      result.push(id);
      continue;
    }
    let prev = routeIds[i - 1];
    let next = routeIds[i + 1];
    let offset = getPerpendicularOffset(prev, next, side);
    let candidate = offsetId(id, offset[0], offset[1]);
    if (candidate && isWalkable(candidate, board)) {
      result.push(candidate);
    } else {
      let alternate = offsetId(id, -offset[0], -offset[1]);
      if (alternate && isWalkable(alternate, board)) {
        result.push(alternate);
      } else {
        result.push(id);
      }
    }
  }
  return sanitizeRouteIds(result);
}

function getPerpendicularOffset(prevId, nextId, side) {
  let [pr, pc] = prevId.split("-").map(Number);
  let [nr, nc] = nextId.split("-").map(Number);
  let dr = nr - pr;
  let dc = nc - pc;
  if (Math.abs(dr) > Math.abs(dc)) {
    return [0, side];
  }
  return [side, 0];
}

function injectDetours(routeIds, board, side, frequency) {
  let detoured = [];
  for (let i = 0; i < routeIds.length; i++) {
    detoured.push(routeIds[i]);
    if (i === 0 || i >= routeIds.length - 1) continue;
    if (i % frequency !== 0) continue;
    let detour = offsetId(routeIds[i], side, 0);
    if (!detour || !isWalkable(detour, board)) {
      detour = offsetId(routeIds[i], 0, side);
    }
    if (detour && isWalkable(detour, board)) {
      detoured.push(detour);
    }
  }
  return sanitizeRouteIds(detoured);
}

function buildRouteShadow(routeKeys) {
  let shadows = [];
  routeKeys.forEach((key, index) => {
    let color = ROUTE_COLORS[key] || "#94a3b8";
    let size = 2 + index * 2;
    shadows.push(`inset 0 0 0 ${size}px ${color}`);
  });
  return shadows.join(", ");
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
