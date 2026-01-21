const Node = require("./node");
const launchAnimations = require("./animations/launchAnimations");
const launchInstantAnimations = require("./animations/launchInstantAnimations");
const mazeGenerationAnimations = require("./animations/mazeGenerationAnimations");
const weightedSearchAlgorithm = require("./pathfindingAlgorithms/weightedSearchAlgorithm");
const unweightedSearchAlgorithm = require("./pathfindingAlgorithms/unweightedSearchAlgorithm");
const recursiveDivisionMaze = require("./mazeAlgorithms/recursiveDivisionMaze");
const otherMaze = require("./mazeAlgorithms/otherMaze");
const otherOtherMaze = require("./mazeAlgorithms/otherOtherMaze");
const astar = require("./pathfindingAlgorithms/astar");
const stairDemonstration = require("./mazeAlgorithms/stairDemonstration");
const weightsDemonstration = require("./mazeAlgorithms/weightsDemonstration");
const simpleDemonstration = require("./mazeAlgorithms/simpleDemonstration");
const bidirectional = require("./pathfindingAlgorithms/bidirectional");
const getDistance = require("./getDistance");
const {
  initializeRouteOverlay,
  updateRouteOverlays,
  clearRouteOverlays,
  deriveAlternativeRoutes,
  highlightRoute
} = require("./routeOverlay");
const {
  initializeRouteComparison,
  updateRouteComparison,
  resetRouteComparison
} = require("./routeComparison");

const algorithmButtonIds = [
  "startButtonDijkstra",
  "startButtonAStar2",
  "startButtonGreedy",
  "startButtonAStar",
  "startButtonAStar3",
  "startButtonBidirectional",
  "startButtonBFS",
  "startButtonDFS"
];

function Board(height, width) {
  this.height = height;
  this.width = width;
  this.start = null;
  this.target = null;
  this.object = null;
  this.boardArray = [];
  this.nodes = {};
  this.nodesToAnimate = [];
  this.objectNodesToAnimate = [];
  this.shortestPathNodesToAnimate = [];
  this.objectShortestPathNodesToAnimate = [];
  this.wallsToAnimate = [];
  this.mouseDown = false;
  this.pressedNodeStatus = "normal";
  this.previouslyPressedNodeStatus = null;
  this.previouslySwitchedNode = null;
  this.previouslySwitchedNodeWeight = 0;
  this.keyDown = false;
  this.algoDone = false;
  this.currentAlgorithm = "dijkstra";
  this.currentHeuristic = null;
  this.numberOfObjects = 0;
  this.isObject = false;
  this.buttonsOn = false;
  this.speed = "fast";
  this.pendingRouteUpdate = null;
}

Board.prototype.setActiveAlgorithmMenuItem = function(activeButtonId) {
  algorithmButtonIds.forEach(buttonId => {
    let element = document.getElementById(buttonId);
    if (!element) return;
    element.classList.toggle("is-active", buttonId === activeButtonId);
  });
};

Board.prototype.setNavbarMenuItemState = function(buttonId, isDisabled) {
  let element = document.getElementById(buttonId);
  if (!element) return;
  let activeClass = element.classList.contains("is-active") ? " is-active" : "";
  element.className = `navbar-inverse navbar-nav${isDisabled ? " disabledA" : ""}${activeClass}`;
};

Board.prototype.initialise = function() {
  this.createGrid();
  this.addEventListeners();
  this.initializeDashboardControls();
  this.initializeRouteVisuals();
  this.setActiveAlgorithmMenuItem("startButtonDijkstra");
  document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize Dijkstra\'s!</button>';
  this.changeStartNodeImages();
  this.toggleTutorialButtons();
};

Board.prototype.initializeRouteVisuals = function() {
  initializeRouteOverlay(this);
  initializeRouteComparison(this, (routeKey, isActive) => {
    highlightRoute(this, routeKey, isActive);
  });
  this.onAlternativeRoutesToggle = () => {
    if (this.routeOverlayState?.routeSummaries) {
      updateRouteComparison(this.routeOverlayState.routeSummaries, this.routeOverlayState.showAlternatives);
    }
  };
};

Board.prototype.scheduleRouteVisuals = function(pathNodes, includesObject) {
  this.pendingRouteUpdate = { pathNodes, includesObject };
};

Board.prototype.applyRouteVisuals = function() {
  if (!this.pendingRouteUpdate) return;
  let { pathNodes, includesObject } = this.pendingRouteUpdate;
  this.pendingRouteUpdate = null;
  this.updateRouteVisuals(pathNodes, includesObject);
};

Board.prototype.updateRouteVisuals = function(pathNodes, includesObject) {
  let baseIds = this.buildPathNodeIds(pathNodes, includesObject);
  if (!baseIds.length) {
    clearRouteOverlays(this);
    resetRouteComparison();
    return;
  }
  let routes = deriveAlternativeRoutes(baseIds, this);
  updateRouteOverlays(this, routes);
  let summaries = this.buildRouteSummaries(routes);
  if (this.routeOverlayState) {
    this.routeOverlayState.routeSummaries = summaries;
  }
  updateRouteComparison(summaries, this.routeOverlayState?.showAlternatives);
};

Board.prototype.buildRouteSummaries = function(routes) {
  let summaries = [];
  let baseMetrics = this.calculateMetrics(routes.recommended.ids);
  let buildSummary = (key, label) => {
    let metrics = this.calculateMetrics(routes[key].ids);
    let delay = Math.max(0, metrics.estimatedTime - baseMetrics.estimatedTime);
    let delayText = delay.toFixed(1).replace(/\.0$/, "");
    let weightedNodes = routes[key].ids.filter(id => this.nodes[id] && this.nodes[id].weight === 15).length;
    let riskLabel = "Low Risk";
    if (weightedNodes > 0 && weightedNodes <= 2) {
      riskLabel = "Medium Risk";
    } else if (weightedNodes > 2) {
      riskLabel = "High Risk ⚠";
    }
    let accessibility = weightedNodes === 0 ? "Accessible ✔" : "Limited Access";
    summaries.push({
      key,
      label,
      delayText: `+${delayText} min`,
      riskLabel,
      accessibility
    });
  };
  buildSummary("recommended", "Recommended");
  buildSummary("flood", "Flood Route");
  buildSummary("delayed", "Delayed");
  return summaries;
};

Board.prototype.createGrid = function() {
  let tableHTML = "";
  for (let r = 0; r < this.height; r++) {
    let currentArrayRow = [];
    let currentHTMLRow = `<tr id="row ${r}">`;
    for (let c = 0; c < this.width; c++) {
      let newNodeId = `${r}-${c}`, newNodeClass, newNode;
      if (r === Math.floor(this.height / 2) && c === Math.floor(this.width / 4)) {
        newNodeClass = "start";
        this.start = `${newNodeId}`;
      } else if (r === Math.floor(this.height / 2) && c === Math.floor(3 * this.width / 4)) {
        newNodeClass = "target";
        this.target = `${newNodeId}`;
      } else {
        newNodeClass = "unvisited";
      }
      newNode = new Node(newNodeId, newNodeClass);
      currentArrayRow.push(newNode);
      currentHTMLRow += `<td id="${newNodeId}" class="${newNodeClass}"></td>`;
      this.nodes[`${newNodeId}`] = newNode;
    }
    this.boardArray.push(currentArrayRow);
    tableHTML += `${currentHTMLRow}</tr>`;
  }
  let board = document.getElementById("board");
  board.innerHTML = tableHTML;
};

Board.prototype.addEventListeners = function() {
  let board = this;
  for (let r = 0; r < board.height; r++) {
    for (let c = 0; c < board.width; c++) {
      let currentId = `${r}-${c}`;
      let currentNode = board.getNode(currentId);
      let currentElement = document.getElementById(currentId);
      currentElement.onmousedown = (e) => {
        e.preventDefault();
        if (this.buttonsOn) {
          board.mouseDown = true;
          if (currentNode.status === "start" || currentNode.status === "target" || currentNode.status === "object") {
            board.pressedNodeStatus = currentNode.status;
          } else {
            board.pressedNodeStatus = "normal";
            board.changeNormalNode(currentNode);
          }
        }
      }
      currentElement.onmouseup = () => {
        if (this.buttonsOn) {
          board.mouseDown = false;
          if (board.pressedNodeStatus === "target") {
            board.target = currentId;
          } else if (board.pressedNodeStatus === "start") {
            board.start = currentId;
          } else if (board.pressedNodeStatus === "object") {
            board.object = currentId;
          }
          board.pressedNodeStatus = "normal";
        }
      }
      currentElement.onmouseenter = () => {
        if (this.buttonsOn) {
          if (board.mouseDown && board.pressedNodeStatus !== "normal") {
            board.changeSpecialNode(currentNode);
            if (board.pressedNodeStatus === "target") {
              board.target = currentId;
              if (board.algoDone) {
                board.redoAlgorithm();
              }
            } else if (board.pressedNodeStatus === "start") {
              board.start = currentId;
              if (board.algoDone) {
                board.redoAlgorithm();
              }
            } else if (board.pressedNodeStatus === "object") {
              board.object = currentId;
              if (board.algoDone) {
                board.redoAlgorithm();
              }
            }
          } else if (board.mouseDown) {
            board.changeNormalNode(currentNode);
          }
        }
      }
      currentElement.onmouseleave = () => {
        if (this.buttonsOn) {
          if (board.mouseDown && board.pressedNodeStatus !== "normal") {
            board.changeSpecialNode(currentNode);
          }
        }
      }
    }
  }
};

Board.prototype.initializeDashboardControls = function() {
  this.updateDashboardAlgorithm();
  this.resetDashboardMetrics("Run a visualization to populate metrics.");
  let toggle = document.getElementById("dataInputToggle");
  let panel = document.getElementById("dataInputPanel");
  let applyButton = document.getElementById("dataInputApply");
  let fileInput = document.getElementById("dataInputFile");

  if (toggle) {
    toggle.onchange = () => {
      panel.classList.toggle("is-hidden", !toggle.checked);
      this.clearDataInputError();
    };
  }

  if (applyButton) {
    applyButton.onclick = () => {
      let textArea = document.getElementById("dataInputTextarea");
      this.applyDataInput(textArea.value);
    };
  }

  if (fileInput) {
    fileInput.onchange = (event) => {
      let file = event.target.files[0];
      if (!file) return;
      let reader = new FileReader();
      reader.onload = (loadEvent) => {
        let textArea = document.getElementById("dataInputTextarea");
        textArea.value = loadEvent.target.result;
        this.applyDataInput(loadEvent.target.result);
      };
      reader.readAsText(file);
    };
  }

  let presetButtons = document.querySelectorAll("[data-preset-id]");
  presetButtons.forEach(button => {
    button.onclick = () => {
      this.applyScenarioPreset(button.getAttribute("data-preset-id"));
    };
  });
};

Board.prototype.getNode = function(id) {
  let coordinates = id.split("-");
  let r = parseInt(coordinates[0]);
  let c = parseInt(coordinates[1]);
  return this.boardArray[r][c];
};

Board.prototype.changeSpecialNode = function(currentNode) {
  let element = document.getElementById(currentNode.id), previousElement;
  if (this.previouslySwitchedNode) previousElement = document.getElementById(this.previouslySwitchedNode.id);
  if (currentNode.status !== "target" && currentNode.status !== "start" && currentNode.status !== "object") {
    if (this.previouslySwitchedNode) {
      this.previouslySwitchedNode.status = this.previouslyPressedNodeStatus;
      previousElement.className = this.previouslySwitchedNodeWeight === 15 ?
      "unvisited weight" : this.previouslyPressedNodeStatus;
      this.previouslySwitchedNode.weight = this.previouslySwitchedNodeWeight === 15 ?
      15 : 0;
      this.previouslySwitchedNode = null;
      this.previouslySwitchedNodeWeight = currentNode.weight;

      this.previouslyPressedNodeStatus = currentNode.status;
      element.className = this.pressedNodeStatus;
      currentNode.status = this.pressedNodeStatus;

      currentNode.weight = 0;
    }
  } else if (currentNode.status !== this.pressedNodeStatus && !this.algoDone) {
    this.previouslySwitchedNode.status = this.pressedNodeStatus;
    previousElement.className = this.pressedNodeStatus;
  } else if (currentNode.status === this.pressedNodeStatus) {
    this.previouslySwitchedNode = currentNode;
    element.className = this.previouslyPressedNodeStatus;
    currentNode.status = this.previouslyPressedNodeStatus;
  }
};

Board.prototype.changeNormalNode = function(currentNode) {
  let element = document.getElementById(currentNode.id);
  let relevantStatuses = ["start", "target", "object"];
  let unweightedAlgorithms = ["dfs", "bfs"]
  if (!this.keyDown) {
    if (!relevantStatuses.includes(currentNode.status)) {
      element.className = currentNode.status !== "wall" ?
        "wall" : "unvisited";
      currentNode.status = element.className !== "wall" ?
        "unvisited" : "wall";
      currentNode.weight = 0;
    }
  } else if (this.keyDown === 87 && !unweightedAlgorithms.includes(this.currentAlgorithm)) {
    if (!relevantStatuses.includes(currentNode.status)) {
      element.className = currentNode.weight !== 15 ?
        "unvisited weight" : "unvisited";
      currentNode.weight = element.className !== "unvisited weight" ?
        0 : 15;
      currentNode.status = "unvisited";
    }
  }
};

Board.prototype.drawShortestPath = function(targetNodeId, startNodeId, object) {
  let currentNode;
  if (this.currentAlgorithm !== "bidirectional") {
    currentNode = this.nodes[this.nodes[targetNodeId].previousNode];
    if (object) {
      while (currentNode.id !== startNodeId) {
        this.objectShortestPathNodesToAnimate.unshift(currentNode);
        currentNode = this.nodes[currentNode.previousNode];
      }
    } else {
      while (currentNode.id !== startNodeId) {
        this.shortestPathNodesToAnimate.unshift(currentNode);
        document.getElementById(currentNode.id).className = `shortest-path`;
        currentNode = this.nodes[currentNode.previousNode];
      }
    }
  } else {
    if (this.middleNode !== this.target && this.middleNode !== this.start) {
      currentNode = this.nodes[this.nodes[this.middleNode].previousNode];
      secondCurrentNode = this.nodes[this.nodes[this.middleNode].otherpreviousNode];
      if (secondCurrentNode.id === this.target) {
        this.nodes[this.target].direction = getDistance(this.nodes[this.middleNode], this.nodes[this.target])[2];
      }
      if (this.nodes[this.middleNode].weight === 0) {
        document.getElementById(this.middleNode).className = `shortest-path`;
      } else {
        document.getElementById(this.middleNode).className = `shortest-path weight`;
      }
      while (currentNode.id !== startNodeId) {
        this.shortestPathNodesToAnimate.unshift(currentNode);
        document.getElementById(currentNode.id).className = `shortest-path`;
        currentNode = this.nodes[currentNode.previousNode];
      }
      while (secondCurrentNode.id !== targetNodeId) {
        this.shortestPathNodesToAnimate.unshift(secondCurrentNode);
        document.getElementById(secondCurrentNode.id).className = `shortest-path`;
        if (secondCurrentNode.otherpreviousNode === targetNodeId) {
          if (secondCurrentNode.otherdirection === "left") {
            secondCurrentNode.direction = "right";
          } else if (secondCurrentNode.otherdirection === "right") {
            secondCurrentNode.direction = "left";
          } else if (secondCurrentNode.otherdirection === "up") {
            secondCurrentNode.direction = "down";
          } else if (secondCurrentNode.otherdirection === "down") {
            secondCurrentNode.direction = "up";
          }
          this.nodes[this.target].direction = getDistance(secondCurrentNode, this.nodes[this.target])[2];
        }
        secondCurrentNode = this.nodes[secondCurrentNode.otherpreviousNode]
      }
    } else {
      document.getElementById(this.nodes[this.target].previousNode).className = `shortest-path`;
    }
  }
};

Board.prototype.addShortestPath = function(targetNodeId, startNodeId, object) {
  let currentNode = this.nodes[this.nodes[targetNodeId].previousNode];
  if (object) {
    while (currentNode.id !== startNodeId) {
      this.objectShortestPathNodesToAnimate.unshift(currentNode);
      currentNode.relatesToObject = true;
      currentNode = this.nodes[currentNode.previousNode];
    }
  } else {
    while (currentNode.id !== startNodeId) {
      this.shortestPathNodesToAnimate.unshift(currentNode);
      currentNode = this.nodes[currentNode.previousNode];
    }
  }
};

Board.prototype.drawShortestPathTimeout = function(targetNodeId, startNodeId, type, object) {
  let board = this;
  let currentNode;
  let secondCurrentNode;
  let currentNodesToAnimate;

  if (board.currentAlgorithm !== "bidirectional") {
    currentNode = board.nodes[board.nodes[targetNodeId].previousNode];
    if (object) {
      board.objectShortestPathNodesToAnimate.push("object");
      currentNodesToAnimate = board.objectShortestPathNodesToAnimate.concat(board.shortestPathNodesToAnimate);
    } else {
      currentNodesToAnimate = [];
      while (currentNode.id !== startNodeId) {
        currentNodesToAnimate.unshift(currentNode);
        currentNode = board.nodes[currentNode.previousNode];
      }
    }
  } else {
    if (board.middleNode !== board.target && board.middleNode !== board.start) {
      currentNode = board.nodes[board.nodes[board.middleNode].previousNode];
      secondCurrentNode = board.nodes[board.nodes[board.middleNode].otherpreviousNode];
      if (secondCurrentNode.id === board.target) {
        board.nodes[board.target].direction = getDistance(board.nodes[board.middleNode], board.nodes[board.target])[2];
      }
      if (object) {

      } else {
        currentNodesToAnimate = [];
        board.nodes[board.middleNode].direction = getDistance(currentNode, board.nodes[board.middleNode])[2];
        while (currentNode.id !== startNodeId) {
          currentNodesToAnimate.unshift(currentNode);
          currentNode = board.nodes[currentNode.previousNode];
        }
        currentNodesToAnimate.push(board.nodes[board.middleNode]);
        while (secondCurrentNode.id !== targetNodeId) {
          if (secondCurrentNode.otherdirection === "left") {
            secondCurrentNode.direction = "right";
          } else if (secondCurrentNode.otherdirection === "right") {
            secondCurrentNode.direction = "left";
          } else if (secondCurrentNode.otherdirection === "up") {
            secondCurrentNode.direction = "down";
          } else if (secondCurrentNode.otherdirection === "down") {
            secondCurrentNode.direction = "up";
          }
          currentNodesToAnimate.push(secondCurrentNode);
          if (secondCurrentNode.otherpreviousNode === targetNodeId) {
            board.nodes[board.target].direction = getDistance(secondCurrentNode, board.nodes[board.target])[2];
          }
          secondCurrentNode = board.nodes[secondCurrentNode.otherpreviousNode]
        }
    }
  } else {
    currentNodesToAnimate = [];
    let target = board.nodes[board.target];
    currentNodesToAnimate.push(board.nodes[target.previousNode], target);
  }

}


  board.updateDashboardMetrics(currentNodesToAnimate, object);
  timeout(0);

  function timeout(index) {
    if (!currentNodesToAnimate.length) currentNodesToAnimate.push(board.nodes[board.start]);
    setTimeout(function () {
      if (index === 0) {
        shortestPathChange(currentNodesToAnimate[index]);
      } else if (index < currentNodesToAnimate.length) {
        shortestPathChange(currentNodesToAnimate[index], currentNodesToAnimate[index - 1]);
      } else if (index === currentNodesToAnimate.length) {
        shortestPathChange(board.nodes[board.target], currentNodesToAnimate[index - 1], "isActualTarget");
      }
      if (index > currentNodesToAnimate.length) {
        board.applyRouteVisuals();
        board.toggleButtons();
        return;
      }
      timeout(index + 1);
    }, 40)
  }


  function shortestPathChange(currentNode, previousNode, isActualTarget) {
    if (currentNode === "object") {
      let element = document.getElementById(board.object);
      element.className = "objectTransparent";
    } else if (currentNode.id !== board.start) {
      if (currentNode.id !== board.target || currentNode.id === board.target && isActualTarget) {
        let currentHTMLNode = document.getElementById(currentNode.id);
        if (type === "unweighted") {
          currentHTMLNode.className = "shortest-path-unweighted";
        } else {
          let direction;
          if (currentNode.relatesToObject && !currentNode.overwriteObjectRelation && currentNode.id !== board.target) {
            direction = "storedDirection";
            currentNode.overwriteObjectRelation = true;
          } else {
            direction = "direction";
          }
          if (currentNode[direction] === "up") {
            currentHTMLNode.className = "shortest-path-up";
          } else if (currentNode[direction] === "down") {
            currentHTMLNode.className = "shortest-path-down";
          } else if (currentNode[direction] === "right") {
            currentHTMLNode.className = "shortest-path-right";
          } else if (currentNode[direction] === "left") {
            currentHTMLNode.className = "shortest-path-left";
          } else {
            currentHTMLNode.className = "shortest-path";
          }
        }
      }
    }
    if (previousNode) {
      if (previousNode !== "object" && previousNode.id !== board.target && previousNode.id !== board.start) {
        let previousHTMLNode = document.getElementById(previousNode.id);
        previousHTMLNode.className = previousNode.weight === 15 ? "shortest-path weight" : "shortest-path";
      }
    } else {
      let element = document.getElementById(board.start);
      element.className = "startTransparent";
    }
  }





};

Board.prototype.createMazeOne = function(type) {
  Object.keys(this.nodes).forEach(node => {
    let random = Math.random();
    let currentHTMLNode = document.getElementById(node);
    let relevantClassNames = ["start", "target", "object"]
    let randomTwo = type === "wall" ? 0.25 : 0.35;
    if (random < randomTwo && !relevantClassNames.includes(currentHTMLNode.className)) {
      if (type === "wall") {
        currentHTMLNode.className = "wall";
        this.nodes[node].status = "wall";
        this.nodes[node].weight = 0;
      } else if (type === "weight") {
        currentHTMLNode.className = "unvisited weight";
        this.nodes[node].status = "unvisited";
        this.nodes[node].weight = 15;
      }
    }
  });
};

Board.prototype.clearPath = function(clickedButton) {
  if (clickedButton) {
    let start = this.nodes[this.start];
    let target = this.nodes[this.target];
    let object = this.numberOfObjects ? this.nodes[this.object] : null;
    start.status = "start";
    document.getElementById(start.id).className = "start";
    target.status = "target";
    document.getElementById(target.id).className = "target";
    if (object) {
      object.status = "object";
      document.getElementById(object.id).className = "object";
    }
  }
  this.resetDashboardMetrics("Run a visualization to populate metrics.");
  clearRouteOverlays(this);
  resetRouteComparison();
  this.pendingRouteUpdate = null;

  document.getElementById("startButtonStart").onclick = () => {
    if (!this.currentAlgorithm) {
      document.getElementById("startButtonStart").innerHTML = '<button class="btn btn-default navbar-btn" type="button">Pick an Algorithm!</button>'
    } else {
      this.clearPath("clickedButton");
      this.toggleButtons();
      let weightedAlgorithms = ["dijkstra", "CLA", "greedy"];
      let unweightedAlgorithms = ["dfs", "bfs"];
      let success;
      if (this.currentAlgorithm === "bidirectional") {
        if (!this.numberOfObjects) {
          success = bidirectional(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic, this);
          launchAnimations(this, success, "weighted");
        } else {
          this.isObject = true;
        }
        this.algoDone = true;
      } else if (this.currentAlgorithm === "astar") {
        if (!this.numberOfObjects) {
          success = weightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
          launchAnimations(this, success, "weighted");
        } else {
          this.isObject = true;
          success = weightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
          launchAnimations(this, success, "weighted", "object", this.currentAlgorithm, this.currentHeuristic);
        }
        this.algoDone = true;
      } else if (weightedAlgorithms.includes(this.currentAlgorithm)) {
        if (!this.numberOfObjects) {
          success = weightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
          launchAnimations(this, success, "weighted");
        } else {
          this.isObject = true;
          success = weightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
          launchAnimations(this, success, "weighted", "object", this.currentAlgorithm, this.currentHeuristic);
        }
        this.algoDone = true;
      } else if (unweightedAlgorithms.includes(this.currentAlgorithm)) {
        if (!this.numberOfObjects) {
          success = unweightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm);
          launchAnimations(this, success, "unweighted");
        } else {
          this.isObject = true;
          success = unweightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm);
          launchAnimations(this, success, "unweighted", "object", this.currentAlgorithm);
        }
        this.algoDone = true;
      }
    }
  }

  this.algoDone = false;
  Object.keys(this.nodes).forEach(id => {
    let currentNode = this.nodes[id];
    currentNode.previousNode = null;
    currentNode.distance = Infinity;
    currentNode.totalDistance = Infinity;
    currentNode.heuristicDistance = null;
    currentNode.direction = null;
    currentNode.storedDirection = null;
    currentNode.relatesToObject = false;
    currentNode.overwriteObjectRelation = false;
    currentNode.otherpreviousNode = null;
    currentNode.otherdistance = Infinity;
    currentNode.otherdirection = null;
    let currentHTMLNode = document.getElementById(id);
    let relevantStatuses = ["wall", "start", "target", "object"];
    if ((!relevantStatuses.includes(currentNode.status) || currentHTMLNode.className === "visitedobject") && currentNode.weight !== 15) {
      currentNode.status = "unvisited";
      currentHTMLNode.className = "unvisited";
    } else if (currentNode.weight === 15) {
      currentNode.status = "unvisited";
      currentHTMLNode.className = "unvisited weight";
    }
  });
};

Board.prototype.clearWalls = function() {
  this.clearPath("clickedButton");
  Object.keys(this.nodes).forEach(id => {
    let currentNode = this.nodes[id];
    let currentHTMLNode = document.getElementById(id);
    if (currentNode.status === "wall" || currentNode.weight === 15) {
      currentNode.status = "unvisited";
      currentNode.weight = 0;
      currentHTMLNode.className = "unvisited";
    }
  });
}

Board.prototype.clearWeights = function() {
  Object.keys(this.nodes).forEach(id => {
    let currentNode = this.nodes[id];
    let currentHTMLNode = document.getElementById(id);
    if (currentNode.weight === 15) {
      currentNode.status = "unvisited";
      currentNode.weight = 0;
      currentHTMLNode.className = "unvisited";
    }
  });
}

Board.prototype.clearNodeStatuses = function() {
  Object.keys(this.nodes).forEach(id => {
    let currentNode = this.nodes[id];
    currentNode.previousNode = null;
    currentNode.distance = Infinity;
    currentNode.totalDistance = Infinity;
    currentNode.heuristicDistance = null;
    currentNode.storedDirection = currentNode.direction;
    currentNode.direction = null;
    let relevantStatuses = ["wall", "start", "target", "object"];
    if (!relevantStatuses.includes(currentNode.status)) {
      currentNode.status = "unvisited";
    }
  })
};

Board.prototype.updateDashboardAlgorithm = function() {
  let algorithmLabel = document.getElementById("dashboardAlgorithm");
  if (!algorithmLabel) return;
  if (!this.currentAlgorithm) {
    algorithmLabel.textContent = "Not Selected";
    return;
  }
  let name = "Custom Algorithm";
  if (this.currentAlgorithm === "bfs") {
    name = "Breadth-first Search";
  } else if (this.currentAlgorithm === "dfs") {
    name = "Depth-first Search";
  } else if (this.currentAlgorithm === "dijkstra") {
    name = "Dijkstra's Algorithm";
  } else if (this.currentAlgorithm === "astar") {
    name = "A* Search";
  } else if (this.currentAlgorithm === "greedy") {
    name = "Greedy Best-first Search";
  } else if (this.currentAlgorithm === "CLA" && this.currentHeuristic !== "extraPoweredManhattanDistance") {
    name = "Swarm Algorithm";
  } else if (this.currentAlgorithm === "CLA" && this.currentHeuristic === "extraPoweredManhattanDistance") {
    name = "Convergent Swarm Algorithm";
  } else if (this.currentAlgorithm === "bidirectional") {
    name = "Bidirectional Swarm Algorithm";
  }
  algorithmLabel.textContent = name;
};

Board.prototype.resetDashboardMetrics = function(message) {
  let pathLength = document.getElementById("metricPathLength");
  let estimatedTime = document.getElementById("metricEstimatedTime");
  let riskScore = document.getElementById("metricRiskScore");
  let comparison = document.getElementById("metricBaselineComparison");
  if (pathLength) pathLength.textContent = "--";
  if (estimatedTime) estimatedTime.textContent = "--";
  if (riskScore) riskScore.textContent = "--";
  if (comparison) comparison.textContent = "--";
  let status = document.getElementById("metricStatus");
  if (status) status.textContent = message || "";
};

Board.prototype.updateDashboardMetrics = function(pathNodes, includesObject) {
  let nodeIds = this.buildPathNodeIds(pathNodes, includesObject);
  if (!nodeIds.length) {
    this.resetDashboardMetrics("No path available.");
    return;
  }
  let metrics = this.calculateMetrics(nodeIds);
  let pathLength = document.getElementById("metricPathLength");
  let estimatedTime = document.getElementById("metricEstimatedTime");
  let riskScore = document.getElementById("metricRiskScore");
  let comparison = document.getElementById("metricBaselineComparison");
  if (pathLength) pathLength.textContent = metrics.pathLength.toString();
  if (estimatedTime) estimatedTime.textContent = metrics.estimatedTime.toFixed(1);
  if (riskScore) riskScore.textContent = metrics.riskScore.toFixed(1);
  if (comparison) {
    if (metrics.baselineImprovement === null) {
      comparison.textContent = "Baseline unavailable";
    } else {
      let direction = metrics.baselineImprovement >= 0 ? "shorter" : "longer";
      comparison.textContent = `${Math.abs(metrics.baselineImprovement).toFixed(1)}% ${direction}`;
    }
  }
  let status = document.getElementById("metricStatus");
  if (status) status.textContent = "Metrics updated from latest path.";
  this.scheduleRouteVisuals(pathNodes, includesObject);
};

Board.prototype.buildPathNodeIds = function(pathNodes, includesObject) {
  let ids = [];
  let nodes = Array.isArray(pathNodes) ? pathNodes : [];
  if (this.start) ids.push(this.start);
  nodes.forEach(node => {
    if (node === "object") {
      if (this.object) ids.push(this.object);
    } else if (node && node.id) {
      ids.push(node.id);
    }
  });
  if (includesObject && this.object && !ids.includes(this.object)) {
    ids.push(this.object);
  }
  if (this.target) ids.push(this.target);
  return ids;
};

Board.prototype.calculateMetrics = function(pathNodeIds) {
  let totalWeight = 0;
  pathNodeIds.forEach(id => {
    let node = this.nodes[id];
    if (node && node.weight) {
      totalWeight += node.weight;
    }
  });
  let pathLength = pathNodeIds.length;
  let weightFactor = pathLength ? 1 + totalWeight / pathLength : 0;
  let estimatedTime = pathLength * weightFactor;
  let riskScore = totalWeight;
  let baselineLength = this.computeBaselinePathLength();
  let baselineImprovement = null;
  if (baselineLength && baselineLength > 0) {
    baselineImprovement = ((baselineLength - pathLength) / baselineLength) * 100;
  }
  return {
    pathLength,
    estimatedTime,
    riskScore,
    baselineLength,
    baselineImprovement
  };
};

Board.prototype.computeBaselinePathLength = function() {
  let useWeights = this.hasWeightedNodes();
  let segments = [];
  if (this.object) {
    segments.push([this.start, this.object]);
    segments.push([this.object, this.target]);
  } else {
    segments.push([this.start, this.target]);
  }
  let totalLength = 0;
  for (let [start, target] of segments) {
    if (!start || !target) return null;
    let length = useWeights ?
      this.dijkstraPathLength(start, target) :
      this.bfsPathLength(start, target);
    if (!length) return null;
    totalLength += length;
  }
  return totalLength;
};

Board.prototype.hasWeightedNodes = function() {
  return Object.keys(this.nodes).some(id => this.nodes[id].weight === 15);
};

Board.prototype.bfsPathLength = function(start, target) {
  if (start === target) return 1;
  let queue = [start];
  let visited = new Set([start]);
  let previous = {};
  while (queue.length) {
    let current = queue.shift();
    if (current === target) break;
    let neighbors = this.getNeighborIds(current);
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        previous[neighbor] = current;
        queue.push(neighbor);
      }
    });
  }
  if (!visited.has(target)) return null;
  let length = 1;
  let step = target;
  while (step !== start) {
    step = previous[step];
    if (!step) return null;
    length += 1;
  }
  return length;
};

Board.prototype.dijkstraPathLength = function(start, target) {
  if (start === target) return 1;
  let distances = {};
  let previous = {};
  let unvisited = Object.keys(this.nodes);
  unvisited.forEach(id => {
    distances[id] = Infinity;
  });
  distances[start] = 0;
  while (unvisited.length) {
    let closestIndex = 0;
    for (let i = 1; i < unvisited.length; i++) {
      if (distances[unvisited[i]] < distances[unvisited[closestIndex]]) {
        closestIndex = i;
      }
    }
    let current = unvisited.splice(closestIndex, 1)[0];
    if (distances[current] === Infinity) break;
    if (current === target) break;
    let neighbors = this.getNeighborIds(current);
    neighbors.forEach(neighbor => {
      if (!unvisited.includes(neighbor)) return;
      let weight = this.nodes[neighbor].weight === 15 ? 15 : 0;
      let tentative = distances[current] + 1 + weight;
      if (tentative < distances[neighbor]) {
        distances[neighbor] = tentative;
        previous[neighbor] = current;
      }
    });
  }
  if (!previous[target] && start !== target) return null;
  let length = 1;
  let step = target;
  while (step !== start) {
    step = previous[step];
    if (!step) return null;
    length += 1;
  }
  return length;
};

Board.prototype.getNeighborIds = function(id) {
  let coordinates = id.split("-");
  let x = parseInt(coordinates[0]);
  let y = parseInt(coordinates[1]);
  let neighbors = [];
  let potential;
  if (this.boardArray[x - 1] && this.boardArray[x - 1][y]) {
    potential = `${x - 1}-${y}`;
    if (this.nodes[potential].status !== "wall") neighbors.push(potential);
  }
  if (this.boardArray[x + 1] && this.boardArray[x + 1][y]) {
    potential = `${x + 1}-${y}`;
    if (this.nodes[potential].status !== "wall") neighbors.push(potential);
  }
  if (this.boardArray[x] && this.boardArray[x][y - 1]) {
    potential = `${x}-${y - 1}`;
    if (this.nodes[potential].status !== "wall") neighbors.push(potential);
  }
  if (this.boardArray[x] && this.boardArray[x][y + 1]) {
    potential = `${x}-${y + 1}`;
    if (this.nodes[potential].status !== "wall") neighbors.push(potential);
  }
  return neighbors;
};

Board.prototype.getBoardDimensions = function() {
  let navbarHeight = document.getElementById("navbarDiv").clientHeight;
  let textHeight = document.getElementById("mainText").clientHeight + document.getElementById("algorithmDescriptor").clientHeight;
  let height = Math.floor((document.documentElement.clientHeight - navbarHeight - textHeight) / 28);
  let layout = document.getElementById("gridLayout");
  let dashboard = document.getElementById("dashboard");
  let widthSource = layout ? layout.clientWidth : document.documentElement.clientWidth;
  let dashboardWidth = dashboard ? dashboard.clientWidth : 0;
  let width = Math.floor((widthSource - dashboardWidth - 30) / 25);
  return {
    height: Math.max(5, height),
    width: Math.max(5, width)
  };
};

Board.prototype.applyScenarioPreset = function(presetId) {
  let presets = window.scenarioPresets || [];
  let preset = presets.find(item => item.id === presetId);
  if (!preset) return;
  let data = preset.build(this.height, this.width);
  this.applyScenarioData(data);
};

Board.prototype.applyScenarioData = function(data) {
  if (!data) return;
  this.clearWalls();
  let recommendation = document.getElementById("scenarioRecommendation");
  if (recommendation) {
    recommendation.textContent = data.recommendation || "Select a preset to view guidance.";
  }
  data.blockedNodes.forEach(id => {
    if (id !== this.start && id !== this.target && id !== this.object) {
      this.nodes[id].status = "wall";
      this.nodes[id].weight = 0;
      document.getElementById(id).className = "wall";
    }
  });
  data.weightedNodes.forEach(entry => {
    let id = entry.id || entry;
    if (id !== this.start && id !== this.target && id !== this.object) {
      this.nodes[id].status = "unvisited";
      this.nodes[id].weight = entry.weight || 15;
      document.getElementById(id).className = "unvisited weight";
    }
  });
  if (this.algoDone) {
    this.redoAlgorithm();
  } else {
    this.resetDashboardMetrics("Scenario applied. Visualize to compute metrics.");
  }
};

Board.prototype.applyDataInput = function(rawText) {
  this.clearDataInputError();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    this.setDataInputError("Invalid JSON. Please check the format and try again.");
    return;
  }
  let config = this.parseGridConfiguration(parsed);
  if (!config) {
    return;
  }
  this.applyGridConfiguration(config);
};

Board.prototype.parseGridConfiguration = function(config) {
  if (!config || typeof config !== "object") {
    this.setDataInputError("JSON must be an object with required fields.");
    return null;
  }
  let blockedNodes = Array.isArray(config.blockedNodes) ? config.blockedNodes : null;
  let weightedNodes = Array.isArray(config.weightedNodes) ? config.weightedNodes : null;
  if (!blockedNodes || !weightedNodes) {
    this.setDataInputError("JSON must include blockedNodes and weightedNodes arrays.");
    return null;
  }
  let startNode = this.normalizeNodeId(config.startNode);
  let endNode = this.normalizeNodeId(config.endNode);
  if (!startNode || !endNode) {
    this.setDataInputError("startNode and endNode must be valid grid coordinates.");
    return null;
  }
  let normalizedBlocked = blockedNodes.map(node => this.normalizeNodeId(node)).filter(Boolean);
  let normalizedWeights = weightedNodes.map(node => {
    if (typeof node === "string" || Array.isArray(node)) {
      let id = this.normalizeNodeId(node);
      return id ? { id, weight: 15 } : null;
    }
    if (node && typeof node === "object") {
      let id = this.normalizeNodeId(node.id || node);
      let weight = parseInt(node.weight, 10);
      if (!id) return null;
      return { id, weight: Number.isNaN(weight) ? 15 : weight };
    }
    return null;
  }).filter(Boolean);
  return {
    blockedNodes: normalizedBlocked,
    weightedNodes: normalizedWeights,
    startNode,
    endNode
  };
};

Board.prototype.normalizeNodeId = function(node) {
  if (!node) return null;
  if (typeof node === "string" && node.includes("-")) {
    let [row, col] = node.split("-").map(Number);
    if (Number.isInteger(row) && Number.isInteger(col)) {
      if (this.boardArray[row] && this.boardArray[row][col]) {
        return `${row}-${col}`;
      }
    }
  }
  if (Array.isArray(node) && node.length === 2) {
    let row = parseInt(node[0], 10);
    let col = parseInt(node[1], 10);
    if (this.boardArray[row] && this.boardArray[row][col]) {
      return `${row}-${col}`;
    }
  }
  if (node && typeof node === "object" && node.row !== undefined && node.col !== undefined) {
    let row = parseInt(node.row, 10);
    let col = parseInt(node.col, 10);
    if (this.boardArray[row] && this.boardArray[row][col]) {
      return `${row}-${col}`;
    }
  }
  return null;
};

Board.prototype.applyGridConfiguration = function(config) {
  this.clearWalls();
  if (this.object) {
    document.getElementById(this.object).className = "unvisited";
    this.nodes[this.object].status = "unvisited";
    this.object = null;
    this.numberOfObjects = 0;
    this.isObject = false;
  }
  if (this.start) {
    document.getElementById(this.start).className = "unvisited";
    this.nodes[this.start].status = "unvisited";
  }
  if (this.target) {
    document.getElementById(this.target).className = "unvisited";
    this.nodes[this.target].status = "unvisited";
  }
  this.start = config.startNode;
  this.target = config.endNode;
  this.nodes[this.start].status = "start";
  this.nodes[this.target].status = "target";
  document.getElementById(this.start).className = "start";
  document.getElementById(this.target).className = "target";

  config.blockedNodes.forEach(id => {
    if (id !== this.start && id !== this.target) {
      this.nodes[id].status = "wall";
      this.nodes[id].weight = 0;
      document.getElementById(id).className = "wall";
    }
  });

  config.weightedNodes.forEach(entry => {
    if (entry.id !== this.start && entry.id !== this.target) {
      this.nodes[entry.id].status = "unvisited";
      this.nodes[entry.id].weight = entry.weight;
      document.getElementById(entry.id).className = "unvisited weight";
    }
  });
  this.algoDone = false;
  this.resetDashboardMetrics("Configuration applied. Visualize to compute metrics.");
};

Board.prototype.setDataInputError = function(message) {
  let errorNode = document.getElementById("dataInputError");
  if (errorNode) {
    errorNode.textContent = message;
  }
};

Board.prototype.clearDataInputError = function() {
  let errorNode = document.getElementById("dataInputError");
  if (errorNode) {
    errorNode.textContent = "";
  }
};

Board.prototype.instantAlgorithm = function() {
  let weightedAlgorithms = ["dijkstra", "CLA", "greedy"];
  let unweightedAlgorithms = ["dfs", "bfs"];
  let success;
  if (this.currentAlgorithm === "bidirectional") {
    if (!this.numberOfObjects) {
      success = bidirectional(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic, this);
      launchInstantAnimations(this, success, "weighted");
    } else {
      this.isObject = true;
    }
    this.algoDone = true;
  } else if (this.currentAlgorithm === "astar") {
    if (!this.numberOfObjects) {
      success = weightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
      launchInstantAnimations(this, success, "weighted");
    } else {
      this.isObject = true;
      success = weightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
      launchInstantAnimations(this, success, "weighted", "object", this.currentAlgorithm);
    }
    this.algoDone = true;
  }
  if (weightedAlgorithms.includes(this.currentAlgorithm)) {
    if (!this.numberOfObjects) {
      success = weightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
      launchInstantAnimations(this, success, "weighted");
    } else {
      this.isObject = true;
      success = weightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
      launchInstantAnimations(this, success, "weighted", "object", this.currentAlgorithm, this.currentHeuristic);
    }
    this.algoDone = true;
  } else if (unweightedAlgorithms.includes(this.currentAlgorithm)) {
    if (!this.numberOfObjects) {
      success = unweightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm);
      launchInstantAnimations(this, success, "unweighted");
    } else {
      this.isObject = true;
      success = unweightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm);
      launchInstantAnimations(this, success, "unweighted", "object", this.currentAlgorithm);
    }
    this.algoDone = true;
  }
};

Board.prototype.redoAlgorithm = function() {
  this.clearPath();
  this.instantAlgorithm();
};

Board.prototype.reset = function(objectNotTransparent) {
  this.nodes[this.start].status = "start";
  document.getElementById(this.start).className = "startTransparent";
  this.nodes[this.target].status = "target";
  if (this.object) {
    this.nodes[this.object].status = "object";
    if (objectNotTransparent) {
      document.getElementById(this.object).className = "visitedObjectNode";
    } else {
      document.getElementById(this.object).className = "objectTransparent";
    }
  }
};

Board.prototype.resetHTMLNodes = function() {
  let start = document.getElementById(this.start);
  let target = document.getElementById(this.target);
  start.className = "start";
  target.className = "target";
};

Board.prototype.changeStartNodeImages = function() {
  let unweighted = ["bfs", "dfs"];
  let strikethrough = ["bfs", "dfs"];
  let guaranteed = ["dijkstra", "astar"];
  let name = "";
  if (this.currentAlgorithm === "bfs") {
    name = "Breath-first Search";
  } else if (this.currentAlgorithm === "dfs") {
    name = "Depth-first Search";
  } else if (this.currentAlgorithm === "dijkstra") {
    name = "Dijkstra's Algorithm";
  } else if (this.currentAlgorithm === "astar") {
    name = "A* Search";
  } else if (this.currentAlgorithm === "greedy") {
    name = "Greedy Best-first Search";
  } else if (this.currentAlgorithm === "CLA" && this.currentHeuristic !== "extraPoweredManhattanDistance") {
    name = "Swarm Algorithm";
  } else if (this.currentAlgorithm === "CLA" && this.currentHeuristic === "extraPoweredManhattanDistance") {
    name = "Convergent Swarm Algorithm";
  } else if (this.currentAlgorithm === "bidirectional") {
    name = "Bidirectional Swarm Algorithm";
  }
  if (unweighted.includes(this.currentAlgorithm)) {
    if (this.currentAlgorithm === "dfs") {
      document.getElementById("algorithmDescriptor").innerHTML = `${name} is <i><b>unweighted</b></i> and <i><b>does not guarantee</b></i> the shortest path!`;
    } else {
      document.getElementById("algorithmDescriptor").innerHTML = `${name} is <i><b>unweighted</b></i> and <i><b>guarantees</b></i> the shortest path!`;
    }
    document.getElementById("weightLegend").className = "strikethrough";
    for (let i = 0; i < 14; i++) {
      let j = i.toString();
      let backgroundImage = document.styleSheets["1"].rules[j].style.backgroundImage;
      document.styleSheets["1"].rules[j].style.backgroundImage = backgroundImage.replace("triangle", "spaceship");
    }
  } else {
    if (this.currentAlgorithm === "greedy" || this.currentAlgorithm === "CLA") {
      document.getElementById("algorithmDescriptor").innerHTML = `${name} is <i><b>weighted</b></i> and <i><b>does not guarantee</b></i> the shortest path!`;
    }
    document.getElementById("weightLegend").className = "";
    for (let i = 0; i < 14; i++) {
      let j = i.toString();
      let backgroundImage = document.styleSheets["1"].rules[j].style.backgroundImage;
      document.styleSheets["1"].rules[j].style.backgroundImage = backgroundImage.replace("spaceship", "triangle");
    }
  }
  if (this.currentAlgorithm === "bidirectional") {

    document.getElementById("algorithmDescriptor").innerHTML = `${name} is <i><b>weighted</b></i> and <i><b>does not guarantee</b></i> the shortest path!`;
    document.getElementById("bombLegend").className = "strikethrough";
    document.getElementById("startButtonAddObject").className = "navbar-inverse navbar-nav disabledA";
  } else {
    document.getElementById("bombLegend").className = "";
    document.getElementById("startButtonAddObject").className = "navbar-inverse navbar-nav";
  }
  if (guaranteed.includes(this.currentAlgorithm)) {
    document.getElementById("algorithmDescriptor").innerHTML = `${name} is <i><b>weighted</b></i> and <i><b>guarantees</b></i> the shortest path!`;
  }
  this.updateDashboardAlgorithm();
  this.resetDashboardMetrics("Algorithm updated. Visualize to compute metrics.");
};

let counter = 1;
Board.prototype.toggleTutorialButtons = function() {

  document.getElementById("skipButton").onclick = () => {
    document.getElementById("tutorial").style.display = "none";
    this.toggleButtons();
  }

  if (document.getElementById("nextButton")) {
    document.getElementById("nextButton").onclick = () => {
      if (counter < 9) counter++;
      nextPreviousClick();
      this.toggleTutorialButtons();
    }
  }

  document.getElementById("previousButton").onclick = () => {
    if (counter > 1) counter--;
    nextPreviousClick();
    this.toggleTutorialButtons()
  }

  let board = this;
  function nextPreviousClick() {
    if (counter === 1) {
      document.getElementById("tutorial").innerHTML = `<h3>Welcome to Pathfinding Visualizer!</h3><h6>This short tutorial will walk you through all of the features of this application.</h6><p>If you want to dive right in, feel free to press the "Skip Tutorial" button below. Otherwise, press "Next"!</p><div id="tutorialCounter">1/9</div><img id="mainTutorialImage" src="public/styling/c_icon.png"><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 2) {
      document.getElementById("tutorial").innerHTML = `<h3>What is a pathfinding algorithm?</h3><h6>At its core, a pathfinding algorithm seeks to find the shortest path between two points. This application visualizes various pathfinding algorithms in action, and more!</h6><p>All of the algorithms on this application are adapted for a 2D grid, where 90 degree turns have a "cost" of 1 and movements from a node to another have a "cost" of 1.</p><div id="tutorialCounter">${counter}/9</div><img id="mainTutorialImage" src="public/styling/path.png"><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 3) {
      document.getElementById("tutorial").innerHTML = `<h3>Picking an algorithm</h3><h6>Choose an algorithm from the "Algorithms" drop-down menu.</h6><p>Note that some algorithms are <i><b>unweighted</b></i>, while others are <i><b>weighted</b></i>. Unweighted algorithms do not take turns or weight nodes into account, whereas weighted ones do. Additionally, not all algorithms guarantee the shortest path. </p><img id="secondTutorialImage" src="public/styling/algorithms.png"><div id="tutorialCounter">${counter}/9</div><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 4) {
      document.getElementById("tutorial").innerHTML = `<h3>Meet the algorithms</h3><h6>Not all algorithms are created equal.</h6><ul><li><b>Dijkstra's Algorithm</b> (weighted): the father of pathfinding algorithms; guarantees the shortest path</li><li><b>A* Search</b> (weighted): arguably the best pathfinding algorithm; uses heuristics to guarantee the shortest path much faster than Dijkstra's Algorithm</li><li><b>Greedy Best-first Search</b> (weighted): a faster, more heuristic-heavy version of A*; does not guarantee the shortest path</li><li><b>Swarm Algorithm</b> (weighted): a mixture of Dijkstra's Algorithm and A*; does not guarantee the shortest-path</li><li><b>Convergent Swarm Algorithm</b> (weighted): the faster, more heuristic-heavy version of Swarm; does not guarantee the shortest path</li><li><b>Bidirectional Swarm Algorithm</b> (weighted): Swarm from both sides; does not guarantee the shortest path</li><li><b>Breath-first Search</b> (unweighted): a great algorithm; guarantees the shortest path</li><li><b>Depth-first Search</b> (unweighted): a very bad algorithm for pathfinding; does not guarantee the shortest path</li></ul><div id="tutorialCounter">${counter}/9</div><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 5) {
      document.getElementById("tutorial").innerHTML = `<h3>Adding walls and weights</h3><h6>Click on the grid to add a wall. Click on the grid while pressing W to add a weight. Generate mazes and patterns from the "Mazes & Patterns" drop-down menu.</h6><p>Walls are impenetrable, meaning that a path cannot cross through them. Weights, however, are not impassable. They are simply more "costly" to move through. In this application, moving through a weight node has a "cost" of 15.</p><img id="secondTutorialImage" src="public/styling/walls.gif"><div id="tutorialCounter">${counter}/9</div><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 6) {
      document.getElementById("tutorial").innerHTML = `<h3>Adding a bomb</h3><h6>Click the "Add Bomb" button.</h6><p>Adding a bomb will change the course of the chosen algorithm. In other words, the algorithm will first look for the bomb (in an effort to diffuse it) and will then look for the target node. Note that the Bidirectional Swarm Algorithm does not support adding a bomb.</p><img id="secondTutorialImage" src="public/styling/bomb.png"><div id="tutorialCounter">${counter}/9</div><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 7) {
      document.getElementById("tutorial").innerHTML = `<h3>Dragging nodes</h3><h6>Click and drag the start, bomb, and target nodes to move them.</h6><p>Note that you can drag nodes even after an algorithm has finished running. This will allow you to instantly see different paths.</p><img src="public/styling/dragging.gif"><div id="tutorialCounter">${counter}/9</div><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 8) {
      document.getElementById("tutorial").innerHTML = `<h3>Visualizing and more</h3><h6>Use the navbar buttons to visualize algorithms and to do other stuff!</h6><p>You can clear the current path, clear walls and weights, clear the entire board, and adjust the visualization speed, all from the navbar. If you want to access this tutorial again, click on "Pathfinding Visualizer" in the top left corner of your screen.</p><img id="secondTutorialImage" src="public/styling/navbar.png"><div id="tutorialCounter">${counter}/9</div><button id="nextButton" class="btn btn-default navbar-btn" type="button">Next</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
    } else if (counter === 9) {
      document.getElementById("tutorial").innerHTML = `<h3>Enjoy!</h3><h6>I hope you have just as much fun playing around with this visualization tool as I had building it!</h6><p>If you want to see the source code for this application, check out my <a href="https://github.com/clementmihailescu/Pathfinding-Visualizer">github</a>.</p><div id="tutorialCounter">${counter}/9</div><button id="finishButton" class="btn btn-default navbar-btn" type="button">Finish</button><button id="previousButton" class="btn btn-default navbar-btn" type="button">Previous</button><button id="skipButton" class="btn btn-default navbar-btn" type="button">Skip Tutorial</button>`
      document.getElementById("finishButton").onclick = () => {
        document.getElementById("tutorial").style.display = "none";
        board.toggleButtons();
      }
    }
  }

};

Board.prototype.toggleButtons = function() {
  document.getElementById("refreshButton").onclick = () => {
    window.location.reload(true);
  }

  if (!this.buttonsOn) {
    this.buttonsOn = true;

    document.getElementById("startButtonStart").onclick = () => {
      if (!this.currentAlgorithm) {
        document.getElementById("startButtonStart").innerHTML = '<button class="btn btn-default navbar-btn" type="button">Pick an Algorithm!</button>'
      } else {
        this.clearPath("clickedButton");
        this.toggleButtons();
        let weightedAlgorithms = ["dijkstra", "CLA", "CLA", "greedy"];
        let unweightedAlgorithms = ["dfs", "bfs"];
        let success;
        if (this.currentAlgorithm === "bidirectional") {
          if (!this.numberOfObjects) {
            success = bidirectional(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic, this);
            launchAnimations(this, success, "weighted");
          } else {
            this.isObject = true;
            success = bidirectional(this.nodes, this.start, this.object, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic, this);
            launchAnimations(this, success, "weighted");
          }
          this.algoDone = true;
        } else if (this.currentAlgorithm === "astar") {
          if (!this.numberOfObjects) {
            success = weightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
            launchAnimations(this, success, "weighted");
          } else {
            this.isObject = true;
            success = weightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
            launchAnimations(this, success, "weighted", "object", this.currentAlgorithm);
          }
          this.algoDone = true;
        } else if (weightedAlgorithms.includes(this.currentAlgorithm)) {
          if (!this.numberOfObjects) {
            success = weightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
            launchAnimations(this, success, "weighted");
          } else {
            this.isObject = true;
            success = weightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm, this.currentHeuristic);
            launchAnimations(this, success, "weighted", "object", this.currentAlgorithm, this.currentHeuristic);
          }
          this.algoDone = true;
        } else if (unweightedAlgorithms.includes(this.currentAlgorithm)) {
          if (!this.numberOfObjects) {
            success = unweightedSearchAlgorithm(this.nodes, this.start, this.target, this.nodesToAnimate, this.boardArray, this.currentAlgorithm);
            launchAnimations(this, success, "unweighted");
          } else {
            this.isObject = true;
            success = unweightedSearchAlgorithm(this.nodes, this.start, this.object, this.objectNodesToAnimate, this.boardArray, this.currentAlgorithm);
            launchAnimations(this, success, "unweighted", "object", this.currentAlgorithm);
          }
          this.algoDone = true;
        }
      }
    }

    document.getElementById("adjustFast").onclick = () => {
      this.speed = "fast";
      document.getElementById("adjustSpeed").innerHTML = 'Speed: Fast<span class="caret"></span>';
    }

    document.getElementById("adjustAverage").onclick = () => {
      this.speed = "average";
      document.getElementById("adjustSpeed").innerHTML = 'Speed: Average<span class="caret"></span>';
    }

    document.getElementById("adjustSlow").onclick = () => {
      this.speed = "slow";
      document.getElementById("adjustSpeed").innerHTML = 'Speed: Slow<span class="caret"></span>';
    }

    document.getElementById("startStairDemonstration").onclick = () => {
      this.clearWalls();
      this.clearPath("clickedButton");
      this.toggleButtons();
      stairDemonstration(this);
      mazeGenerationAnimations(this);
    }


    document.getElementById("startButtonBidirectional").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize Bidirectional Swarm!</button>'
      this.currentAlgorithm = "bidirectional";
      this.currentHeuristic = "manhattanDistance";
      this.setActiveAlgorithmMenuItem("startButtonBidirectional");
      if (this.numberOfObjects) {
        let objectNodeId = this.object;
        document.getElementById("startButtonAddObject").innerHTML = '<a href="#">Add a Bomb</a></li>';
        document.getElementById(objectNodeId).className = "unvisited";
        this.object = null;
        this.numberOfObjects = 0;
        this.nodes[objectNodeId].status = "unvisited";
        this.isObject = false;
      }
      this.clearPath("clickedButton");
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonDijkstra").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize Dijkstra\'s!</button>'
      this.currentAlgorithm = "dijkstra";
      this.setActiveAlgorithmMenuItem("startButtonDijkstra");
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonAStar").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize Swarm!</button>'
      this.currentAlgorithm = "CLA";
      this.currentHeuristic = "manhattanDistance"
      this.setActiveAlgorithmMenuItem("startButtonAStar");
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonAStar2").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize A*!</button>'
      this.currentAlgorithm = "astar";
      this.currentHeuristic = "poweredManhattanDistance"
      this.setActiveAlgorithmMenuItem("startButtonAStar2");
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonAStar3").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize Convergent Swarm!</button>'
      this.currentAlgorithm = "CLA";
      this.currentHeuristic = "extraPoweredManhattanDistance"
      this.setActiveAlgorithmMenuItem("startButtonAStar3");
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonGreedy").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize Greedy!</button>'
      this.currentAlgorithm = "greedy";
      this.setActiveAlgorithmMenuItem("startButtonGreedy");
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonBFS").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize BFS!</button>'
      this.currentAlgorithm = "bfs";
      this.setActiveAlgorithmMenuItem("startButtonBFS");
      this.clearWeights();
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonDFS").onclick = () => {
      document.getElementById("startButtonStart").innerHTML = '<button id="actualStartButton" class="btn btn-default navbar-btn" type="button">Visualize DFS!</button>'
      this.currentAlgorithm = "dfs";
      this.setActiveAlgorithmMenuItem("startButtonDFS");
      this.clearWeights();
      this.changeStartNodeImages();
    }

    document.getElementById("startButtonCreateMazeOne").onclick = () => {
      this.clearWalls();
      this.clearPath("clickedButton");
      this.createMazeOne("wall");
    }

    document.getElementById("startButtonCreateMazeTwo").onclick = () => {
      this.clearWalls();
      this.clearPath("clickedButton");
      this.toggleButtons();
      recursiveDivisionMaze(this, 2, this.height - 3, 2, this.width - 3, "horizontal", false, "wall");
      mazeGenerationAnimations(this);
    }

    document.getElementById("startButtonCreateMazeWeights").onclick = () => {
      this.clearWalls();
      this.clearPath("clickedButton");
      this.createMazeOne("weight");
    }

    document.getElementById("startButtonClearBoard").onclick = () => {
      document.getElementById("startButtonAddObject").innerHTML = '<a href="#">Add Bomb</a></li>';



      let dimensions = this.getBoardDimensions();
      let height = dimensions.height;
      let width = dimensions.width;
      let start = Math.floor(height / 2).toString() + "-" + Math.floor(width / 4).toString();
      let target = Math.floor(height / 2).toString() + "-" + Math.floor(3 * width / 4).toString();

        Object.keys(this.nodes).forEach(id => {
          let currentNode = this.nodes[id];
          let currentHTMLNode = document.getElementById(id);
          if (id === start) {
            currentHTMLNode.className = "start";
            currentNode.status = "start";
          } else if (id === target) {
            currentHTMLNode.className = "target";
            currentNode.status = "target"
          } else {
            currentHTMLNode.className = "unvisited";
            currentNode.status = "unvisited";
          }
          currentNode.previousNode = null;
          currentNode.path = null;
          currentNode.direction = null;
          currentNode.storedDirection = null;
          currentNode.distance = Infinity;
          currentNode.totalDistance = Infinity;
          currentNode.heuristicDistance = null;
          currentNode.weight = 0;
          currentNode.relatesToObject = false;
          currentNode.overwriteObjectRelation = false;

        });
      this.start = start;
      this.target = target;
      this.object = null;
      this.nodesToAnimate = [];
      this.objectNodesToAnimate = [];
      this.shortestPathNodesToAnimate = [];
      this.objectShortestPathNodesToAnimate = [];
      this.wallsToAnimate = [];
      this.mouseDown = false;
      this.pressedNodeStatus = "normal";
      this.previouslyPressedNodeStatus = null;
      this.previouslySwitchedNode = null;
      this.previouslySwitchedNodeWeight = 0;
      this.keyDown = false;
      this.algoDone = false;
      this.numberOfObjects = 0;
      this.isObject = false;
      this.resetDashboardMetrics("Board cleared. Visualize to compute metrics.");
    }

    document.getElementById("startButtonClearWalls").onclick = () => {
      this.clearWalls();
    }

    document.getElementById("startButtonClearPath").onclick = () => {
      this.clearPath("clickedButton");
    }

    document.getElementById("startButtonCreateMazeThree").onclick = () => {
      this.clearWalls();
      this.clearPath("clickedButton");
      this.toggleButtons();
      otherMaze(this, 2, this.height - 3, 2, this.width - 3, "vertical", false);
      mazeGenerationAnimations(this);
    }

    document.getElementById("startButtonCreateMazeFour").onclick = () => {
      this.clearWalls();
      this.clearPath("clickedButton");
      this.toggleButtons();
      otherOtherMaze(this, 2, this.height - 3, 2, this.width - 3, "horizontal", false);
      mazeGenerationAnimations(this);
    }

    document.getElementById("startButtonAddObject").onclick = () => {
      let innerHTML = document.getElementById("startButtonAddObject").innerHTML;
      if (this.currentAlgorithm !== "bidirectional") {
        if (innerHTML.includes("Add")) {
          let r = Math.floor(this.height / 2);
          let c = Math.floor(2 * this.width / 4);
          let objectNodeId = `${r}-${c}`;
          if (this.target === objectNodeId || this.start === objectNodeId || this.numberOfObjects === 1) {
            console.log("Failure to place object.");
          } else {
            document.getElementById("startButtonAddObject").innerHTML = '<a href="#">Remove Bomb</a></li>';
            this.clearPath("clickedButton");
            this.object = objectNodeId;
            this.numberOfObjects = 1;
            this.nodes[objectNodeId].status = "object";
            document.getElementById(objectNodeId).className = "object";
          }
        } else {
          let objectNodeId = this.object;
          document.getElementById("startButtonAddObject").innerHTML = '<a href="#">Add Bomb</a></li>';
          document.getElementById(objectNodeId).className = "unvisited";
          this.object = null;
          this.numberOfObjects = 0;
          this.nodes[objectNodeId].status = "unvisited";
          this.isObject = false;
          this.clearPath("clickedButton");
        }
      }

    }

    document.getElementById("startButtonClearPath").className = "navbar-inverse navbar-nav";
    document.getElementById("startButtonClearWalls").className = "navbar-inverse navbar-nav";
    document.getElementById("startButtonClearBoard").className = "navbar-inverse navbar-nav";
    if (this.currentAlgorithm !== "bidirectional") {
      document.getElementById("startButtonAddObject").className = "navbar-inverse navbar-nav";
    }
    document.getElementById("startButtonCreateMazeOne").className = "navbar-inverse navbar-nav";
    document.getElementById("startButtonCreateMazeTwo").className = "navbar-inverse navbar-nav";
    document.getElementById("startButtonCreateMazeThree").className = "navbar-inverse navbar-nav";
    document.getElementById("startButtonCreateMazeFour").className = "navbar-inverse navbar-nav";
    document.getElementById("startButtonCreateMazeWeights").className = "navbar-inverse navbar-nav";
    document.getElementById("startStairDemonstration").className = "navbar-inverse navbar-nav";
    this.setNavbarMenuItemState("startButtonDFS", false);
    this.setNavbarMenuItemState("startButtonBFS", false);
    this.setNavbarMenuItemState("startButtonDijkstra", false);
    this.setNavbarMenuItemState("startButtonAStar", false);
    this.setNavbarMenuItemState("startButtonAStar2", false);
    this.setNavbarMenuItemState("startButtonAStar3", false);
    document.getElementById("adjustFast").className = "navbar-inverse navbar-nav";
    document.getElementById("adjustAverage").className = "navbar-inverse navbar-nav";
    document.getElementById("adjustSlow").className = "navbar-inverse navbar-nav";
    this.setNavbarMenuItemState("startButtonBidirectional", false);
    this.setNavbarMenuItemState("startButtonGreedy", false);
    document.getElementById("actualStartButton").style.backgroundColor = "";

  } else {
    this.buttonsOn = false;
    document.getElementById("startButtonDFS").onclick = null;
    document.getElementById("startButtonBFS").onclick = null;
    document.getElementById("startButtonDijkstra").onclick = null;
    document.getElementById("startButtonAStar").onclick = null;
    document.getElementById("startButtonGreedy").onclick = null;
    document.getElementById("startButtonAddObject").onclick = null;
    document.getElementById("startButtonAStar2").onclick = null;
    document.getElementById("startButtonAStar3").onclick = null;
    document.getElementById("startButtonBidirectional").onclick = null;
    document.getElementById("startButtonCreateMazeOne").onclick = null;
    document.getElementById("startButtonCreateMazeTwo").onclick = null;
    document.getElementById("startButtonCreateMazeThree").onclick = null;
    document.getElementById("startButtonCreateMazeFour").onclick = null;
    document.getElementById("startButtonCreateMazeWeights").onclick = null;
    document.getElementById("startStairDemonstration").onclick = null;
    document.getElementById("startButtonClearPath").onclick = null;
    document.getElementById("startButtonClearWalls").onclick = null;
    document.getElementById("startButtonClearBoard").onclick = null;
    document.getElementById("startButtonStart").onclick = null;
    document.getElementById("adjustFast").onclick = null;
    document.getElementById("adjustAverage").onclick = null;
    document.getElementById("adjustSlow").onclick = null;

    document.getElementById("adjustFast").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("adjustAverage").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("adjustSlow").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonClearPath").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonClearWalls").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonClearBoard").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonAddObject").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonCreateMazeOne").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonCreateMazeTwo").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonCreateMazeThree").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonCreateMazeFour").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startButtonCreateMazeWeights").className = "navbar-inverse navbar-nav disabledA";
    document.getElementById("startStairDemonstration").className = "navbar-inverse navbar-nav disabledA";
    this.setNavbarMenuItemState("startButtonDFS", true);
    this.setNavbarMenuItemState("startButtonBFS", true);
    this.setNavbarMenuItemState("startButtonDijkstra", true);
    this.setNavbarMenuItemState("startButtonAStar", true);
    this.setNavbarMenuItemState("startButtonGreedy", true);
    this.setNavbarMenuItemState("startButtonAStar2", true);
    this.setNavbarMenuItemState("startButtonAStar3", true);
    this.setNavbarMenuItemState("startButtonBidirectional", true);

    document.getElementById("actualStartButton").style.backgroundColor = "rgb(185, 15, 15)";
  }


}

function getInitialBoardDimensions() {
  let navbarHeight = document.getElementById("navbarDiv").clientHeight;
  let textHeight = document.getElementById("mainText").clientHeight + document.getElementById("algorithmDescriptor").clientHeight;
  let height = Math.floor((document.documentElement.clientHeight - navbarHeight - textHeight) / 28);
  let layout = document.getElementById("gridLayout");
  let dashboard = document.getElementById("dashboard");
  let widthSource = layout ? layout.clientWidth : document.documentElement.clientWidth;
  let dashboardWidth = dashboard ? dashboard.clientWidth : 0;
  let width = Math.floor((widthSource - dashboardWidth - 30) / 25);
  return {
    height: Math.max(5, height),
    width: Math.max(5, width)
  };
}

let dimensions = getInitialBoardDimensions();
let newBoard = new Board(dimensions.height, dimensions.width)
newBoard.initialise();

window.onkeydown = (e) => {
  newBoard.keyDown = e.keyCode;
}

window.onkeyup = (e) => {
  newBoard.keyDown = false;
}
