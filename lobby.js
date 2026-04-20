const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";

const Lobby = {
  state: {
    connected: false,
    roomId: "",
    playerId: "",
    hostId: "",
    players: [],
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
      enterGameButton: document.getElementById("enterGameButton"),
      leaveRoomButton: document.getElementById("leaveRoomButton"),
      lobbyStatusValue: document.getElementById("lobbyStatusValue"),
      currentRoomValue: document.getElementById("currentRoomValue"),
      playerRoleValue: document.getElementById("playerRoleValue"),
      roomPopulationValue: document.getElementById("roomPopulationValue"),
      roomPlayerList: document.getElementById("roomPlayerList")
    };

    const saved = this.loadSession();
    this.elements.playerNameInput.value = saved?.name || `Player-${Math.random().toString(36).slice(2, 5)}`;
    this.elements.roomCodeInput.value = saved?.roomId || `room-${Math.random().toString(36).slice(2, 6)}`;

    this.elements.createRoomButton.addEventListener("click", () => {
      this.elements.roomCodeInput.value = `room-${Math.random().toString(36).slice(2, 6)}`;
      this.joinRoom();
    });
    this.elements.joinRoomButton.addEventListener("click", () => this.joinRoom());
    this.elements.enterGameButton.addEventListener("click", () => this.enterGame());
    this.elements.leaveRoomButton.addEventListener("click", () => this.leaveRoom());

    if (saved?.roomId && saved?.playerId) {
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
  getRoleLabel() {
    if (!this.state.connected) return "Solo";
    return this.state.playerId === this.state.hostId ? "Host" : "Player";
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
    this.elements.enterGameButton.disabled = !this.state.connected;
    this.elements.leaveRoomButton.disabled = !this.state.connected;
    this.elements.createRoomButton.disabled = this.state.connected;
    this.elements.joinRoomButton.disabled = this.state.connected;
    this.renderPlayers();
  },
  async joinRoom(override = null) {
    const saved = override || {};
    const roomId = String(saved.roomId || this.elements.roomCodeInput.value).trim().toLowerCase();
    const name = String(saved.name || this.elements.playerNameInput.value).trim() || "Player";
    const playerId = String(saved.playerId || "").trim();
    if (!roomId) return;

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
      this.elements.lobbyStatusValue.textContent = payload.error || "Join failed";
      return;
    }

    this.state.connected = true;
    this.state.roomId = payload.roomId;
    this.state.playerId = payload.playerId;
    this.state.hostId = payload.hostId || "";
    this.state.players = payload.players || [];
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
        this.state.hostId = message.hostId || "";
        this.state.players = message.players || [];
        this.updateUI();
      }
    };
  },
  async leaveRoom() {
    if (!this.state.connected) return;
    await fetch(this.apiPath("/leave"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.state.roomId, playerId: this.state.playerId })
    }).catch(() => {});
    if (this.state.eventSource) this.state.eventSource.close();
    this.state = { connected: false, roomId: "", playerId: "", hostId: "", players: [], eventSource: null, navigatingToGame: false };
    this.clearSession();
    this.updateUI();
  },
  enterGame() {
    if (!this.state.connected) return;
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
