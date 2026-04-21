const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";

function loadSession() {
  try {
    const raw = sessionStorage.getItem(MULTIPLAYER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function apiPath(path) {
  if (window.location.protocol.startsWith("http")) return path;
  return `http://localhost:3000${path}`;
}

function getAccuracy(stats) {
  const answered = Number(stats?.answered || 0);
  const correct = Number(stats?.correct || 0);
  if (answered <= 0) return 0;
  return Math.round((correct / answered) * 100);
}

function getAverageResponse(stats) {
  const answered = Number(stats?.answered || 0);
  const total = Number(stats?.totalResponseMs || 0);
  if (answered <= 0) return 0;
  return Math.round(total / answered);
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const aWave = Number(a.board?.wave || 0);
    const bWave = Number(b.board?.wave || 0);
    const aAccuracy = getAccuracy(a.stats);
    const bAccuracy = getAccuracy(b.stats);
    const aResponse = getAverageResponse(a.stats);
    const bResponse = getAverageResponse(b.stats);
    return (
      (Number(b.hp || 0) - Number(a.hp || 0)) ||
      (bWave - aWave) ||
      (Number(b.gold || 0) - Number(a.gold || 0)) ||
      (bAccuracy - aAccuracy) ||
      (aResponse - bResponse)
    );
  });
}

function renderResults(players, playerId, roomId) {
  const roomLabel = document.getElementById("resultsRoomLabel");
  const list = document.getElementById("resultsList");
  roomLabel.textContent = roomId ? `Room ${roomId.toUpperCase()} final standings` : "Room results";
  list.innerHTML = "";

  const sorted = sortPlayers(players);
  sorted.forEach((player, index) => {
    const accuracy = getAccuracy(player.stats);
    const avgResponse = getAverageResponse(player.stats);
    const wave = Number(player.board?.wave || 0);
    const card = document.createElement("article");
    card.className = `result-card${player.id === playerId ? " you" : ""}`;
    card.innerHTML = `
      <div class="placement-badge">#${index + 1}</div>
      <div class="player-copy">
        <h3>${player.name}${player.id === playerId ? " (You)" : ""}</h3>
        <p>${player.side === "host" ? "Host" : "Player"} · ${player.hp ?? 0} HP · Wave ${wave} · ${player.gold ?? 0}g</p>
      </div>
      <div class="accuracy-ring" style="--ring-angle:${accuracy * 3.6}deg">
        <span>${accuracy}%</span>
      </div>
      <div class="result-metric">
        <strong>${avgResponse} ms</strong>
        <span>Avg Response</span>
      </div>
      <div class="result-metric">
        <strong>${player.stats?.correct || 0}/${player.stats?.answered || 0}</strong>
        <span>Correct Answers</span>
      </div>
    `;
    list.appendChild(card);
  });
}

async function initResults() {
  const session = loadSession();
  const list = document.getElementById("resultsList");
  if (!session?.roomId || !session?.name) {
    list.innerHTML = "<p>No multiplayer room was found for results.</p>";
    return;
  }

  try {
    const response = await fetch(apiPath("/join"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: session.roomId,
        name: session.name,
        playerId: session.playerId || ""
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      list.innerHTML = `<p>${payload.error || "Could not load results."}</p>`;
      return;
    }
    sessionStorage.setItem(MULTIPLAYER_SESSION_KEY, JSON.stringify({
      roomId: payload.roomId,
      name: session.name,
      playerId: payload.playerId
    }));
    renderResults(payload.players || [], payload.playerId, payload.roomId);
  } catch (error) {
    list.innerHTML = "<p>Could not load results.</p>";
  }
}

window.addEventListener("load", initResults);
