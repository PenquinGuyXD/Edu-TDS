const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";

const MAPS = [
  {
    id: "meadow-pass",
    name: "Meadow Pass",
    description: "A winding grassland route with lots of mid-range tower spots."
  },
  {
    id: "canyon-switchback",
    name: "Canyon Switchback",
    description: "A tighter set of turns that rewards quick reactions and layered fire."
  },
  {
    id: "frost-arc",
    name: "Frost Arc",
    description: "Long lanes and sweeping bends create perfect sniper sightlines."
  }
];

const Lobby = {
  state: {
    connected: false,
    roomId: "",
    playerId: "",
    hostId: "",
    players: [],
    selectedMapId: MAPS[0].id,
    matchStarted: false,
    eventSource: null,
    navigatingToGame: false
  },
  elements: {},
  init() {
    this.elements = {
      playerNameInput: document.getElementById("playerNameInput"),
      roomCodeInput: document.getElementById("roomCodeInput"),
      createRoomButton: document.getElementById("createRoomButton"),
      joinRoomButton: document.getElementById("joinRoomButton"),
      editQuestionsButton: document.getElementById("editQuestionsButton"),
      enterGameButton: document.getElementById("enterGameButton"),
      leaveRoomButton: document.getElementById("leaveRoomButton"),
      lobbyStatusValue: document.getElementById("lobbyStatusValue"),
      currentRoomValue: document.getElementById("currentRoomValue"),
      playerRoleValue: document.getElementById("playerRoleValue"),
      roomPopulationValue: document.getElementById("roomPopulationValue"),
      selectedMapValue: document.getElementById("selectedMapValue"),
      matchStateValue: document.getElementById("matchStateValue"),
      roomPlayerList: document.getElementById("roomPlayerList"),
      mapSelectionList: document.getElementById("mapSelectionList")
    };

    const saved = this.loadSession();
    this.elements.playerNameInput.value = saved?.name || `Player-${Math.random().toString(36).slice(2, 5)}`;
    this.elements.roomCodeInput.value = `room-${Math.random().toString(36).slice(2, 6)}`;

    this.renderMaps();

    this.elements.createRoomButton.addEventListener("click", () => this.createRoom());
    this.elements.joinRoomButton.addEventListener("click", () => this.joinRoom());
    this.elements.editQuestionsButton.addEventListener("click", () => window.open("questions.html", "_blank", "noopener"));
    this.elements.enterGameButton.addEventListener("click", () => this.enterGame());
    this.elements.leaveRoomButton.addEventListener("click", () => this.leaveRoom());

    if (saved?.roomId && saved?.playerId) {
      this.elements.roomCodeInput.value = saved.roomId;
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
  renderMaps() {
    const list = this.elements.mapSelectionList;
    list.innerHTML = "";
    MAPS.forEach((map) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `map-card${this.state.selectedMapId === map.id ? " selected" : ""}`;
      button.innerHTML = `<h3>${map.name}</h3><p>${map.description}</p>`;
      button.disabled = !this.isHost() || this.state.matchStarted;
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
    this.elements.lobbyStatusValue.textContent = this.state.connected ? "Connected" : "Offline";
    this.elements.currentRoomValue.textContent = this.state.roomId || "None";
    this.elements.playerRoleValue.textContent = this.getRoleLabel();
    this.elements.roomPopulationValue.textContent = `${this.state.players.length}/50`;
    this.elements.selectedMapValue.textContent = this.getSelectedMap().name;
    this.elements.matchStateValue.textContent = this.state.matchStarted ? "Started" : "Waiting";
    this.elements.editQuestionsButton.disabled = !this.isHost();
    this.elements.enterGameButton.disabled = !this.state.connected || (!this.isHost() && !this.state.matchStarted);
    this.elements.leaveRoomButton.disabled = !this.state.connected;
    this.elements.createRoomButton.disabled = this.state.connected;
    this.elements.joinRoomButton.disabled = this.state.connected;
    this.renderPlayers();
    this.renderMaps();
  },
  applySnapshot(snapshot) {
    this.state.hostId = snapshot.hostId || "";
    this.state.players = Array.isArray(snapshot.players) ? snapshot.players : [];
    this.state.selectedMapId = snapshot.selectedMapId || MAPS[0].id;
    this.state.matchStarted = Boolean(snapshot.matchStarted);
  },
  async createRoom() {
    this.clearSession();
    if (this.state.connected) {
      await this.leaveRoom();
    }
    this.state.navigatingToGame = false;
    this.elements.roomCodeInput.value = `room-${Math.random().toString(36).slice(2, 6)}`;
    await this.joinRoom();
  },
  async joinRoom(override = null) {
    const saved = override || {};
    const roomId = String(saved.roomId || this.elements.roomCodeInput.value).trim().toLowerCase();
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
      body: JSON.stringify({ roomId, name, playerId })
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
    if (!this.isHost() || this.state.matchStarted) return;
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
      selectedMapId: MAPS[0].id,
      matchStarted: false,
      eventSource: null,
      navigatingToGame: false
    };
    this.clearSession();
    this.updateUI();
  },
  async enterGame(fromAuto = false) {
    if (!this.state.connected) return;
    if (!this.isHost() && !this.state.matchStarted) return;

    if (this.isHost() && !this.state.matchStarted) {
      const response = await fetch(this.apiPath("/relay"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.state.roomId,
          playerId: this.state.playerId,
          type: "lobby_start",
          payload: { mapId: this.state.selectedMapId }
        })
      }).catch(() => null);

      if (!response || !response.ok) {
        this.elements.lobbyStatusValue.textContent = "Could not start the room";
        return;
      }
      this.state.matchStarted = true;
    }

    this.state.navigatingToGame = true;
    window.location.href = "index.html";
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
