const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";
const DEFAULT_MATCH_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_RR_MATCH_DURATION_MS = 2 * 60 * 1000;
const DEFAULT_RR_DIFFICULTY = "medium";
const GAMES = [
  {
    id: "tower-defense",
    name: "Tower Defense",
    description: "Defend the path, build towers, answer questions, and outlast the room."
  },
  {
    id: "reflect-rumble",
    name: "Reflect Rumble",
    description: "Fast arcade FPS action powered by the files in the fps folder."
  },
  {
    id: "practice-tests",
    name: "Practice Tests",
    description: "Take a custom-question practice test and review analytics at the end."
  }
];

const MAPS = [
  {
    id: "meadow-pass",
    name: "Meadow Pass",
    description: "A winding grassland route with lots of mid-range tower spots.",
    pathWidth: 64,
    pathOuter: "#a88a68",
    pathInner: "#d4bb96",
    points: [
      { x: 0, y: 98 }, { x: 164, y: 98 }, { x: 164, y: 220 }, { x: 356, y: 220 }, { x: 356, y: 132 },
      { x: 598, y: 132 }, { x: 598, y: 332 }, { x: 774, y: 332 }, { x: 774, y: 442 }, { x: 960, y: 442 }
    ]
  },
  {
    id: "canyon-switchback",
    name: "Canyon Switchback",
    description: "A tighter set of turns that rewards quick reactions and layered fire.",
    pathWidth: 60,
    pathOuter: "#8c5b42",
    pathInner: "#d7a276",
    points: [
      { x: 0, y: 430 }, { x: 158, y: 430 }, { x: 158, y: 338 }, { x: 310, y: 338 }, { x: 310, y: 460 },
      { x: 520, y: 460 }, { x: 520, y: 182 }, { x: 712, y: 182 }, { x: 712, y: 72 }, { x: 960, y: 72 }
    ]
  },
  {
    id: "frost-arc",
    name: "Frost Arc",
    description: "Long lanes and sweeping bends create perfect sniper sightlines.",
    pathWidth: 68,
    pathOuter: "#7ca4b4",
    pathInner: "#bed7dd",
    points: [
      { x: 0, y: 170 }, { x: 230, y: 170 }, { x: 230, y: 78 }, { x: 454, y: 78 }, { x: 454, y: 266 },
      { x: 670, y: 266 }, { x: 670, y: 430 }, { x: 826, y: 430 }, { x: 826, y: 302 }, { x: 960, y: 302 }
    ]
  },
  {
    id: "crossover-circuit",
    name: "Crossover Circuit",
    description: "A crossing central lane that bends into a rounded right-side loop.",
    pathWidth: 64,
    pathOuter: "#7f8ea6",
    pathInner: "#cad4e4",
    points: [
      { x: 0, y: 132 }, { x: 510, y: 132 }, { x: 670, y: 332 }, { x: 820, y: 468 }, { x: 930, y: 456 },
      { x: 960, y: 396 }, { x: 900, y: 290 }, { x: 832, y: 110 }, { x: 676, y: 108 }, { x: 450, y: 318 },
      { x: 226, y: 480 }, { x: 0, y: 480 }
    ]
  }
];

function createMapPreviewDataUri(map) {
  const width = 120;
  const height = 78;
  const scaleX = width / 960;
  const scaleY = height / 540;
  const points = map.points.map((point) => `${(point.x * scaleX).toFixed(1)},${(point.y * scaleY).toFixed(1)}`).join(" ");
  const innerWidth = Math.max(8, (map.pathWidth - 18) * ((scaleX + scaleY) / 2));
  const outerWidth = Math.max(innerWidth + 6, map.pathWidth * ((scaleX + scaleY) / 2));
  const prev = map.points[map.points.length - 2] || map.points[0];
  const end = map.points[map.points.length - 1];
  const endX = end.x * scaleX;
  const endY = end.y * scaleY;
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const segmentLength = Math.max(1, Math.hypot(dx, dy));
  const normalX = (-dy / segmentLength) * scaleX;
  const normalY = (dx / segmentLength) * scaleY;
  const normalLength = Math.max(0.001, Math.hypot(normalX, normalY));
  const unitNormalX = normalX / normalLength;
  const unitNormalY = normalY / normalLength;
  const lineLength = outerWidth + 10;
  const halfLine = lineLength / 2;
  const lineThickness = 4;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#19311b"/>
          <stop offset="100%" stop-color="#224525"/>
        </linearGradient>
        <linearGradient id="endGlow" x1="${(endX - unitNormalX * halfLine).toFixed(1)}" y1="${(endY - unitNormalY * halfLine).toFixed(1)}" x2="${(endX + unitNormalX * halfLine).toFixed(1)}" y2="${(endY + unitNormalY * halfLine).toFixed(1)}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="rgba(255,83,83,0)"/>
          <stop offset="45%" stop-color="rgba(255,83,83,0.35)"/>
          <stop offset="100%" stop-color="#ff5353"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="12" fill="url(#bg)"/>
      <g opacity="0.12" stroke="#ffffff" stroke-width="0.8">
        ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 13}" x2="${width}" y2="${i * 13}"/>`).join("")}
        ${Array.from({ length: 10 }, (_, i) => `<line x1="${i * 13}" y1="0" x2="${i * 13}" y2="${height}"/>`).join("")}
      </g>
      <polyline points="${points}" fill="none" stroke="${map.pathOuter}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${outerWidth.toFixed(1)}"/>
      <polyline points="${points}" fill="none" stroke="${map.pathInner}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${innerWidth.toFixed(1)}"/>
      <line x1="${(endX - unitNormalX * halfLine).toFixed(1)}" y1="${(endY - unitNormalY * halfLine).toFixed(1)}" x2="${(endX + unitNormalX * halfLine).toFixed(1)}" y2="${(endY + unitNormalY * halfLine).toFixed(1)}" stroke="url(#endGlow)" stroke-width="${lineThickness}" stroke-linecap="round"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function formatDurationMs(durationMs) {
  const totalSeconds = Math.max(10, Math.round((Number(durationMs) || DEFAULT_MATCH_DURATION_MS) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

function parseDurationInput(value) {
  const trimmed = String(value || "").trim();
  const match = /^(\d{1,2})(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2] || 0);
  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds < 10) return null;
  return totalSeconds * 1000;
}

function getDefaultDurationForGame(gameId) {
  return gameId === "reflect-rumble" ? DEFAULT_RR_MATCH_DURATION_MS : DEFAULT_MATCH_DURATION_MS;
}

function getGameLaunchPath(gameId) {
  if (gameId === "reflect-rumble") return "brainrush-arcade-launcher.html";
  if (gameId === "practice-tests") return "practice-tests.html";
  return "index.html";
}

function createFreshRoomCode() {
  return `room-${Math.random().toString(36).slice(2, 6)}`;
}

const Lobby = {
  state: {
    currentView: "offline",
    connected: false,
    roomId: "",
    playerId: "",
    hostId: "",
    players: [],
    selectedGameId: "",
    selectedMapId: MAPS[0].id,
    matchDurationMs: DEFAULT_MATCH_DURATION_MS,
    rrDifficulty: DEFAULT_RR_DIFFICULTY,
    rrPowerupsEnabled: true,
    matchStarted: false,
    eventSource: null,
    navigatingToGame: false
  },
  elements: {},
  init() {
    this.elements = {
      playerNameInput: document.getElementById("playerNameInput"),
      joinRoomCodeInput: document.getElementById("joinRoomCodeInput"),
      joinRoomCodeGroup: document.getElementById("joinRoomCodeGroup"),
      createdRoomCodeGroup: document.getElementById("createdRoomCodeGroup"),
      createdRoomCodeValue: document.getElementById("createdRoomCodeValue"),
      offlineViewButton: document.getElementById("offlineViewButton"),
      onlineViewButton: document.getElementById("onlineViewButton"),
      offlineLobbyView: document.getElementById("offlineLobbyView"),
      onlineLobbyView: document.getElementById("onlineLobbyView"),
      createRoomButton: document.getElementById("createRoomButton"),
      joinRoomButton: document.getElementById("joinRoomButton"),
      startOfflineButton: document.getElementById("startOfflineButton"),
      offlineEditQuestionsButton: document.getElementById("offlineEditQuestionsButton"),
      editQuestionsButton: document.getElementById("editQuestionsButton"),
      enterGameButton: document.getElementById("enterGameButton"),
      leaveRoomButton: document.getElementById("leaveRoomButton"),
      lobbyStatusValue: document.getElementById("lobbyStatusValue"),
      currentRoomValue: document.getElementById("currentRoomValue"),
      playerRoleValue: document.getElementById("playerRoleValue"),
      roomPopulationValue: document.getElementById("roomPopulationValue"),
      selectedGameValue: document.getElementById("selectedGameValue"),
      selectedMapValue: document.getElementById("selectedMapValue"),
      selectedTimerValue: document.getElementById("selectedTimerValue"),
      matchStateValue: document.getElementById("matchStateValue"),
      roomPlayerList: document.getElementById("roomPlayerList"),
      gameSelectionList: document.getElementById("gameSelectionList"),
      mapSelectionList: document.getElementById("mapSelectionList"),
      matchDurationInput: document.getElementById("matchDurationInput"),
      rrDifficultySelect: document.getElementById("rrDifficultySelect"),
      rrPowerupsEnabled: document.getElementById("rrPowerupsEnabled")
    };

    const saved = this.loadSession();
    this.elements.playerNameInput.value = saved?.name || `Player-${Math.random().toString(36).slice(2, 5)}`;
    this.elements.joinRoomCodeInput.value = "";

    this.renderGames();
    this.renderMaps();

    this.elements.createRoomButton.addEventListener("click", () => this.createRoom());
    this.elements.joinRoomButton.addEventListener("click", () => this.joinRoom());
    this.elements.offlineViewButton.addEventListener("click", () => this.setView("offline"));
    this.elements.onlineViewButton.addEventListener("click", () => this.setView("online"));
    this.elements.startOfflineButton.addEventListener("click", () => this.startOfflineGame());
    this.elements.offlineEditQuestionsButton.addEventListener("click", () => window.location.href = "questions.html");
    this.elements.editQuestionsButton.addEventListener("click", () => window.open("questions.html", "_blank", "noopener"));
    this.elements.enterGameButton.addEventListener("click", () => this.enterGame());
    this.elements.leaveRoomButton.addEventListener("click", () => this.leaveRoom());
    this.elements.matchDurationInput.addEventListener("change", () => this.updateMatchDuration());
    this.elements.rrDifficultySelect.addEventListener("change", () => this.updateRRDifficulty());
    this.elements.rrPowerupsEnabled.addEventListener("change", () => this.updateRRPowerups());
    this.elements.playerNameInput.addEventListener("change", () => this.updatePlayerName());
    this.elements.playerNameInput.addEventListener("blur", () => this.updatePlayerName());
    this.elements.matchDurationInput.addEventListener("blur", () => {
      const parsed = parseDurationInput(this.elements.matchDurationInput.value);
      if (parsed) {
        this.state.matchDurationMs = parsed;
      }
      this.elements.matchDurationInput.value = formatDurationMs(this.state.matchDurationMs);
    });

    if (saved?.roomId && saved?.playerId) {
      this.elements.createdRoomCodeValue.textContent = saved.roomId;
      this.joinRoom(saved);
    } else {
      this.updateUI();
    }
  },
  apiPath(path) {
    if (window.location.protocol.startsWith("http")) return path;
    return `http://localhost:3000${path}`;
  },
  loadSession() {
    try {
      const raw = sessionStorage.getItem(MULTIPLAYER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  },
  saveSession(session) {
    sessionStorage.setItem(MULTIPLAYER_SESSION_KEY, JSON.stringify(session));
  },
  clearSession() {
    sessionStorage.removeItem(MULTIPLAYER_SESSION_KEY);
  },
  isHost() {
    return this.state.connected && this.state.playerId === this.state.hostId;
  },
  getRoleLabel() {
    if (!this.state.connected) return "Solo";
    return this.isHost() ? "Host" : "Player";
  },
  getSelectedMap() {
    return MAPS.find((map) => map.id === this.state.selectedMapId) || MAPS[0];
  },
  getSelectedGame() {
    return GAMES.find((game) => game.id === this.state.selectedGameId) || null;
  },
  renderGames() {
    const list = this.elements.gameSelectionList;
    list.innerHTML = "";
    const visibleGames = (this.state.currentView === "online" || this.state.connected)
      ? GAMES.filter((game) => game.id !== "practice-tests")
      : GAMES;
    if (this.state.connected && !this.isHost()) {
      const notice = document.createElement("div");
      notice.className = "room-player-empty";
      notice.textContent = "Only the host can choose the game for this room.";
      list.appendChild(notice);
      return;
    }
    visibleGames.forEach((game) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `game-card${this.state.selectedGameId === game.id ? " selected" : ""}`;
      button.disabled = this.state.connected ? (!this.isHost() || this.state.matchStarted) : false;
      button.innerHTML = `
        <h3>${game.name}</h3>
        <p>${game.description}</p>
      `;
      button.addEventListener("click", () => this.selectGame(game.id));
      list.appendChild(button);
    });
  },
  renderMaps() {
    const list = this.elements.mapSelectionList;
    list.innerHTML = "";
    if (!this.state.selectedGameId) {
      const notice = document.createElement("div");
      notice.className = "room-player-empty";
      notice.textContent = "Choose a game first to unlock map selection.";
      list.appendChild(notice);
      return;
    }
    if (this.state.selectedGameId !== "tower-defense") {
      return;
    }
    MAPS.forEach((map) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `map-card${this.state.selectedMapId === map.id ? " selected" : ""}`;
      button.innerHTML = `
        <div class="map-card-layout">
          <div class="map-card-copy">
            <h3>${map.name}</h3>
            <p>${map.description}</p>
          </div>
          <img class="map-preview" src="${createMapPreviewDataUri(map)}" alt="${map.name} preview" />
        </div>
      `;
      button.disabled = this.state.connected ? (!this.isHost() || this.state.matchStarted || !this.state.selectedGameId) : false;
      button.addEventListener("click", () => this.selectMap(map.id));
      list.appendChild(button);
    });
  },
  renderPlayers() {
    const list = this.elements.roomPlayerList;
    list.innerHTML = "";
    if (!this.state.players.length) {
      const item = document.createElement("li");
      item.className = "room-player-empty";
      item.textContent = "No one is in a room yet.";
      list.appendChild(item);
      return;
    }
    this.state.players.forEach((player) => {
      const item = document.createElement("li");
      item.className = "room-player-item";
      const hp = typeof player.hp === "number" ? `${player.hp} HP` : "Waiting";
      const gold = typeof player.gold === "number" ? `${player.gold}g` : "--";
      item.innerHTML = `
        <div>
          <strong>${player.name}</strong>
          <span>${player.id === this.state.hostId ? "Host" : "Player"}${player.id === this.state.playerId ? " - You" : ""}</span>
        </div>
        <strong>${hp} | ${gold}</strong>
      `;
      list.appendChild(item);
    });
  },
  updateUI() {
    this.elements.offlineLobbyView.classList.toggle("active", this.state.currentView === "offline");
    this.elements.onlineLobbyView.classList.toggle("active", this.state.currentView === "online");
    this.elements.offlineViewButton.classList.toggle("selected", this.state.currentView === "offline");
    this.elements.onlineViewButton.classList.toggle("selected", this.state.currentView === "online");
    this.elements.joinRoomCodeGroup.classList.toggle("hidden", this.state.connected);
    this.elements.createdRoomCodeGroup.classList.toggle("hidden", !this.state.connected);
    this.elements.createdRoomCodeValue.textContent = this.state.roomId || "room-0000";
    this.elements.lobbyStatusValue.textContent = this.state.connected ? "Connected" : "Offline";
    this.elements.currentRoomValue.textContent = this.state.roomId || "None";
    this.elements.playerRoleValue.textContent = this.getRoleLabel();
    this.elements.roomPopulationValue.textContent = `${this.state.players.length}/50`;
    this.elements.selectedGameValue.textContent = this.getSelectedGame()?.name || "None";
    this.elements.selectedMapValue.textContent = this.state.selectedGameId === "tower-defense"
      ? this.getSelectedMap().name
      : "N/A";
    this.elements.selectedTimerValue.textContent = formatDurationMs(this.state.matchDurationMs);
    this.elements.matchStateValue.textContent = this.state.matchStarted ? "Started" : "Waiting";
    this.elements.editQuestionsButton.disabled = !this.isHost();
    this.elements.offlineEditQuestionsButton.disabled = false;
    this.elements.enterGameButton.disabled = !this.state.connected || (!this.isHost() && !this.state.matchStarted);
    this.elements.leaveRoomButton.disabled = !this.state.connected;
    this.elements.createRoomButton.disabled = false;
    this.elements.joinRoomButton.disabled = this.state.connected;
    this.elements.startOfflineButton.disabled = this.state.connected || !this.state.selectedGameId;
    this.elements.matchDurationInput.disabled = this.state.connected ? (!this.isHost() || this.state.matchStarted) : false;
    this.elements.matchDurationInput.value = formatDurationMs(this.state.matchDurationMs);
    this.elements.rrDifficultySelect.disabled = this.state.connected ? (!this.isHost() || this.state.matchStarted) : false;
    this.elements.rrPowerupsEnabled.disabled = this.state.connected ? (!this.isHost() || this.state.matchStarted) : false;
    this.elements.rrDifficultySelect.value = this.state.rrDifficulty || DEFAULT_RR_DIFFICULTY;
    this.elements.rrPowerupsEnabled.checked = this.state.rrPowerupsEnabled !== false;
    const rrControlsVisible = this.state.selectedGameId === "reflect-rumble";
    const timerVisible = this.state.selectedGameId !== "practice-tests";
    this.elements.matchDurationInput.closest(".timer-config-row")?.classList.toggle("hidden", !timerVisible);
    this.elements.rrDifficultySelect.closest(".rr-config-row")?.classList.toggle("hidden", !rrControlsVisible);
    this.renderGames();
    this.renderPlayers();
    this.renderMaps();
  },
  setView(view) {
    this.state.currentView = view === "online" ? "online" : "offline";
    this.updateUI();
  },
  applySnapshot(snapshot) {
    this.state.hostId = snapshot.hostId || "";
    this.state.players = Array.isArray(snapshot.players) ? snapshot.players : [];
    this.state.selectedGameId = snapshot.selectedGameId || "";
    this.state.selectedMapId = snapshot.selectedMapId || MAPS[0].id;
    this.state.matchDurationMs = Number(snapshot.matchDurationMs) || DEFAULT_MATCH_DURATION_MS;
    this.state.rrDifficulty = String(snapshot.rrDifficulty || DEFAULT_RR_DIFFICULTY);
    this.state.rrPowerupsEnabled = snapshot.rrPowerupsEnabled !== false;
    this.state.matchStarted = Boolean(snapshot.matchStarted);
    const self = this.state.players.find((player) => player.id === this.state.playerId);
    if (self?.name) {
      this.elements.playerNameInput.value = self.name;
    }
  },
  async createRoom() {
    const name = String(this.elements.playerNameInput.value).trim() || "Player";
    const roomId = createFreshRoomCode();

    if (this.state.connected) {
      await this.leaveRoom();
    } else {
      this.clearSession();
    }

    this.setView("online");
    this.state.navigatingToGame = false;
    this.elements.joinRoomCodeInput.value = "";
    this.elements.lobbyStatusValue.textContent = "Creating room";
    this.elements.createdRoomCodeValue.textContent = roomId;
    await this.joinRoom({ roomId, name, playerId: "" });
  },
  async joinRoom(override = null) {
    const saved = override || {};
    const roomId = String(saved.roomId || this.elements.joinRoomCodeInput.value).trim().toLowerCase();
    const name = String(saved.name || this.elements.playerNameInput.value).trim() || "Player";
    const playerId = String(saved.playerId || "").trim();
    if (!roomId) {
      this.elements.lobbyStatusValue.textContent = "Room code needed";
      return;
    }

    if (this.state.connected && this.state.roomId !== roomId) {
      await this.leaveRoom();
    }

    const response = await fetch(this.apiPath("/join"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, name, playerId, matchDurationMs: this.state.matchDurationMs })
    }).catch(() => null);

    if (!response) {
      this.elements.lobbyStatusValue.textContent = "Server Offline";
      return;
    }

    const payload = await response.json();
    if (!response.ok) {
      this.clearSession();
      this.elements.lobbyStatusValue.textContent = payload.error || "Join failed";
      return;
    }

    this.state.connected = true;
    this.state.roomId = payload.roomId;
    this.state.playerId = payload.playerId;
    this.applySnapshot(payload);
    this.saveSession({ roomId: payload.roomId, name, playerId: payload.playerId });
    this.openStream();
    this.updateUI();
  },
  openStream() {
    if (this.state.eventSource) this.state.eventSource.close();
    const url = `${this.apiPath("/events")}?roomId=${encodeURIComponent(this.state.roomId)}&playerId=${encodeURIComponent(this.state.playerId)}`;
    this.state.eventSource = new EventSource(url);
    this.state.eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "room_update") {
        this.applySnapshot(message);
        this.updateUI();
        if (this.state.matchStarted && !this.isHost()) {
          this.enterGame(true);
        }
      }
    };
    this.state.eventSource.onerror = () => {
      this.elements.lobbyStatusValue.textContent = "Connection lost";
    };
  },
  async selectMap(mapId) {
    if (!this.isHost() || this.state.matchStarted || this.state.selectedGameId !== "tower-defense") return;
    this.state.selectedMapId = mapId;
    this.updateUI();
    await fetch(this.apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type: "select_map",
        payload: { mapId }
      })
    }).catch(() => {
      this.elements.lobbyStatusValue.textContent = "Map update failed";
    });
  },
  async selectGame(gameId) {
    if (this.state.connected && (!this.isHost() || this.state.matchStarted)) return;
    const previousGameId = this.state.selectedGameId;
    const previousDefault = getDefaultDurationForGame(previousGameId);
    const nextDefault = getDefaultDurationForGame(gameId);
    this.state.selectedGameId = gameId;
    if (gameId !== "tower-defense") {
      this.state.selectedMapId = MAPS[0].id;
    }
    if (!previousGameId || this.state.matchDurationMs === previousDefault) {
      this.state.matchDurationMs = nextDefault;
    }
    this.updateUI();
    if (!this.state.connected) return;
    if (this.state.matchDurationMs === nextDefault) {
      await fetch(this.apiPath("/relay"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.state.roomId,
          playerId: this.state.playerId,
          type: "select_duration",
          payload: { matchDurationMs: nextDefault }
        })
      }).catch(() => {
        this.elements.lobbyStatusValue.textContent = "Timer update failed";
      });
    }
    await fetch(this.apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type: "select_game",
        payload: { gameId }
      })
    }).catch(() => {
      this.elements.lobbyStatusValue.textContent = "Game update failed";
    });
  },
  async updateMatchDuration() {
    const parsed = parseDurationInput(this.elements.matchDurationInput.value);
    if (!this.state.connected) {
      if (!parsed) {
        this.elements.lobbyStatusValue.textContent = "Use a timer like 3:00 or 10:00";
        this.elements.matchDurationInput.value = formatDurationMs(this.state.matchDurationMs);
        return;
      }
      this.state.matchDurationMs = parsed;
      this.updateUI();
      return;
    }
    if (!this.isHost() || this.state.matchStarted) {
      this.elements.matchDurationInput.value = formatDurationMs(this.state.matchDurationMs);
      return;
    }
    if (!parsed) {
      this.elements.lobbyStatusValue.textContent = "Use a timer like 3:00 or 10:00";
      this.elements.matchDurationInput.value = formatDurationMs(this.state.matchDurationMs);
      return;
    }
    this.state.matchDurationMs = parsed;
    this.updateUI();
    await fetch(this.apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type: "select_duration",
        payload: { matchDurationMs: parsed }
      })
    }).catch(() => {
      this.elements.lobbyStatusValue.textContent = "Timer update failed";
    });
  },
  async updateRRDifficulty() {
    const difficulty = String(this.elements.rrDifficultySelect.value || DEFAULT_RR_DIFFICULTY).trim().toLowerCase();
    this.state.rrDifficulty = difficulty;
    this.updateUI();
    if (!this.state.connected || !this.isHost() || this.state.matchStarted) return;
    await fetch(this.apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type: "select_rr_difficulty",
        payload: { difficulty }
      })
    }).catch(() => {
      this.elements.lobbyStatusValue.textContent = "RR difficulty update failed";
    });
  },
  async updateRRPowerups() {
    const enabled = Boolean(this.elements.rrPowerupsEnabled.checked);
    this.state.rrPowerupsEnabled = enabled;
    this.updateUI();
    if (!this.state.connected || !this.isHost() || this.state.matchStarted) return;
    await fetch(this.apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type: "select_rr_powerups",
        payload: { enabled }
      })
    }).catch(() => {
      this.elements.lobbyStatusValue.textContent = "RR power-up update failed";
    });
  },
  async updatePlayerName() {
    const name = String(this.elements.playerNameInput.value).trim().slice(0, 24) || "Player";
    this.elements.playerNameInput.value = name;
    if (!this.state.connected || !this.state.roomId || !this.state.playerId) return;

    const response = await fetch(this.apiPath("/join"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        name,
        playerId: this.state.playerId,
        matchDurationMs: this.state.matchDurationMs
      })
    }).catch(() => null);

    if (!response) {
      this.elements.lobbyStatusValue.textContent = "Could not update name";
      return;
    }

    const payload = await response.json();
    if (!response.ok) {
      this.elements.lobbyStatusValue.textContent = payload.error || "Could not update name";
      return;
    }

    this.applySnapshot(payload);
    this.saveSession({ roomId: payload.roomId, name, playerId: payload.playerId });
    this.updateUI();
  },
  async leaveRoom() {
    if (!this.state.connected) return;
    await fetch(this.apiPath("/leave"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.state.roomId, playerId: this.state.playerId })
    }).catch(() => {});
    if (this.state.eventSource) this.state.eventSource.close();
    this.state = {
      connected: false,
      roomId: "",
      playerId: "",
      hostId: "",
      players: [],
      selectedGameId: "",
      selectedMapId: MAPS[0].id,
      matchDurationMs: DEFAULT_MATCH_DURATION_MS,
      rrDifficulty: DEFAULT_RR_DIFFICULTY,
      rrPowerupsEnabled: true,
      matchStarted: false,
      eventSource: null,
      navigatingToGame: false
    };
    this.clearSession();
    this.updateUI();
  },
  async startOfflineGame() {
    if (!this.state.selectedGameId) {
      this.elements.lobbyStatusValue.textContent = "Choose a game first";
      return;
    }
    if (this.state.connected) {
      await this.leaveRoom();
    } else {
      this.clearSession();
    }
    this.state.navigatingToGame = true;
    window.location.href = getGameLaunchPath(this.state.selectedGameId);
  },
  async enterGame(fromAuto = false) {
    if (!this.state.connected) return;
    if (!this.isHost() && !this.state.matchStarted) return;
    if (this.isHost() && !this.state.selectedGameId) {
      this.elements.lobbyStatusValue.textContent = "Choose a game first";
      return;
    }

    if (this.isHost() && !this.state.matchStarted) {
      const response = await fetch(this.apiPath("/relay"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.state.roomId,
          playerId: this.state.playerId,
          type: "lobby_start",
          payload: { mapId: this.state.selectedMapId, gameId: this.state.selectedGameId }
        })
      }).catch(() => null);

      if (!response || !response.ok) {
        this.elements.lobbyStatusValue.textContent = "Could not start the room";
        return;
      }
      this.state.matchStarted = true;
    }

    this.state.navigatingToGame = true;
    window.location.href = getGameLaunchPath(this.state.selectedGameId);
  }
};

window.addEventListener("load", () => Lobby.init());

window.addEventListener("beforeunload", () => {
  if (Lobby.state.connected && !Lobby.state.navigatingToGame) {
    navigator.sendBeacon(
      Lobby.apiPath("/leave"),
      JSON.stringify({ roomId: Lobby.state.roomId, playerId: Lobby.state.playerId })
    );
  }
});
