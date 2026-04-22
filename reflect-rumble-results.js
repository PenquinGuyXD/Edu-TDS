const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";
const RR_RESULTS_KEY = "reflect-rumble-results";

function apiPath(path) {
  if (window.location.protocol.startsWith("http")) return path;
  return `http://localhost:3000${path}`;
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(MULTIPLAYER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function loadResults() {
  try {
    const raw = sessionStorage.getItem(RR_RESULTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(MULTIPLAYER_SESSION_KEY);
  sessionStorage.removeItem(RR_RESULTS_KEY);
}

function getAccuracy(player) {
  const roundsPlayed = Number(player.stats?.roundsPlayed || 0);
  const roundsCorrect = Number(player.stats?.roundsCorrect || 0);
  if (!roundsPlayed) return 0;
  return Math.round((roundsCorrect / roundsPlayed) * 100);
}

function getMissPercentage(player) {
  const shots = Number(player.stats?.shots || 0);
  const misses = Number(player.stats?.misses || 0);
  if (!shots) return 0;
  return Math.round((misses / shots) * 100);
}

function getPoints(player) {
  return Number(player.stats?.points || player.board?.points || 0);
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    return getPoints(b) - getPoints(a) || getAccuracy(b) - getAccuracy(a) || getMissPercentage(a) - getMissPercentage(b);
  });
}

function renderResults(roomId, playerId, players) {
  document.getElementById("resultsRoomLabel").textContent = roomId === "solo"
    ? "Solo Reflect Rumble results"
    : `Room ${String(roomId || "").toUpperCase()} Reflect Rumble standings`;
  const list = document.getElementById("resultsList");
  list.innerHTML = "";
  sortPlayers(players).forEach((player, index) => {
    const accuracy = getAccuracy(player);
    const missPercentage = getMissPercentage(player);
    const points = getPoints(player);
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="player-copy">
        <h3><span class="inline-rank">#${index + 1}</span>${player.name}${player.id === playerId ? " (You)" : ""}</h3>
        <p>${player.side === "host" ? "Host" : player.side === "solo" ? "Solo" : "Player"} | ${points} pts</p>
      </div>
      <div class="accuracy-ring" style="--ring-angle:${accuracy * 3.6}deg">
        <span>${accuracy}%</span>
      </div>
      <div class="result-metric">
        <strong>${missPercentage}%</strong>
        <span>Miss Rate</span>
      </div>
      <div class="result-metric">
        <strong>${points}</strong>
        <span>Points</span>
      </div>
    `;
    list.appendChild(card);
  });
}

async function leaveRoomAndExit() {
  const session = loadSession();
  const cached = loadResults();
  if (session?.roomId && session?.playerId) {
    await fetch(apiPath("/leave"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: session.roomId, playerId: session.playerId })
    }).catch(() => {});
  }
  clearSession();
    window.location.href = cached?.roomId === "solo" ? "brainrush-arcade-launcher.html" : "lobby.html";
}

async function init() {
  const cached = loadResults();
  const session = loadSession();
  if (cached?.players?.length) {
    renderResults(cached.roomId, cached.playerId, cached.players);
  }

  document.getElementById("leaveResultsRoomLink").addEventListener("click", async (event) => {
    event.preventDefault();
    await leaveRoomAndExit();
  });
  document.getElementById("returnToLobbyLink").addEventListener("click", async (event) => {
    event.preventDefault();
    await leaveRoomAndExit();
  });

  if (cached?.roomId === "solo") return;
  if (!session?.roomId || !session?.playerId) return;

  try {
    const response = await fetch(apiPath("/join"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: session.roomId,
        playerId: session.playerId,
        name: session.name
      })
    });
    const payload = await response.json();
    if (!response.ok) return;
    const players = payload.players || cached?.players || [];
    sessionStorage.setItem(RR_RESULTS_KEY, JSON.stringify({
      roomId: payload.roomId,
      playerId: payload.playerId,
      players
    }));
    renderResults(payload.roomId, payload.playerId, players);
  } catch (error) {}
}

window.addEventListener("load", init);
