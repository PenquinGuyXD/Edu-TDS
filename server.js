const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_ROOM_PLAYERS = 50;
const DEFAULT_MAP_ID = "meadow-pass";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const rooms = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions
    .map((entry) => {
      const question = String(entry.question || "").trim();
      const answer = String(entry.answer || "").trim();
      const reward = Math.max(1, Number(entry.reward) || 0);
      const options = Array.isArray(entry.options)
        ? entry.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      if (!question || !answer || options.length < 2 || !options.includes(answer)) return null;
      return { question, options, answer, reward };
    })
    .filter(Boolean)
    .slice(0, 500);
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: [],
      streams: new Map(),
      hostId: "",
      hostQuestions: [],
      playerHealths: {},
      playerGolds: {},
      playerBoards: {},
      selectedMapId: DEFAULT_MAP_ID,
      matchStarted: false
    });
  }
  return rooms.get(roomId);
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId) || null;
}

function normalizeRoom(room) {
  if (!room.players.length) {
    room.hostId = "";
    room.hostQuestions = [];
    return;
  }
  if (!room.players.some((player) => player.id === room.hostId)) {
    room.hostId = room.players[0].id;
  }
  room.players.forEach((player) => {
    player.side = player.id === room.hostId ? "host" : "player";
    if (typeof room.playerHealths[player.id] !== "number") {
      room.playerHealths[player.id] = 100;
    }
    if (typeof room.playerGolds[player.id] !== "number") {
      room.playerGolds[player.id] = 120;
    }
  });
}

function buildRoomSnapshot(room) {
  normalizeRoom(room);
  return {
    roomId: room.id,
    hostId: room.hostId,
    hostQuestions: room.hostQuestions,
    selectedMapId: room.selectedMapId,
    matchStarted: room.matchStarted,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      side: player.side,
      hp: typeof room.playerHealths[player.id] === "number" ? room.playerHealths[player.id] : null,
      gold: typeof room.playerGolds[player.id] === "number" ? room.playerGolds[player.id] : null,
      board: room.playerBoards[player.id] || null
    }))
  };
}

function publish(room, event) {
  room.streams.forEach((stream, playerId) => {
    if (event.target && event.target !== playerId) return;
    stream.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

function publishRoom(room) {
  publish(room, {
    type: "room_update",
    ...buildRoomSnapshot(room)
  });
}

function handleJoin(req, res, body) {
  const roomId = String(body.roomId || "").trim().toLowerCase();
  const name = String(body.name || "Player").trim().slice(0, 24) || "Player";
  const requestedPlayerId = String(body.playerId || "").trim();
  if (!roomId) {
    sendJson(res, 400, { error: "Room code is required." });
    return;
  }

  const room = getOrCreateRoom(roomId);
  const existingPlayer = requestedPlayerId ? getPlayer(room, requestedPlayerId) : null;
  if (existingPlayer) {
    existingPlayer.name = name;
    if (existingPlayer.id === room.hostId) {
      room.hostQuestions = sanitizeQuestions(body.questions);
    }
    normalizeRoom(room);
    const snapshot = buildRoomSnapshot(room);
    publishRoom(room);
    sendJson(res, 200, {
      roomId,
      playerId: existingPlayer.id,
      side: existingPlayer.side,
      hostId: room.hostId,
      hostQuestions: room.hostQuestions,
      selectedMapId: room.selectedMapId,
      matchStarted: room.matchStarted,
      players: snapshot.players
    });
    return;
  }

  if (room.players.length >= MAX_ROOM_PLAYERS) {
    sendJson(res, 409, { error: "Room is full." });
    return;
  }

  const player = {
    id: randomUUID(),
    name,
    side: room.players.length === 0 ? "host" : "player"
  };

  room.players.push(player);
  room.playerHealths[player.id] = 100;
  room.playerGolds[player.id] = 120;
  if (room.players.length === 1) {
    room.hostId = player.id;
    room.hostQuestions = sanitizeQuestions(body.questions);
  }

  normalizeRoom(room);
  const snapshot = buildRoomSnapshot(room);
  publishRoom(room);

  sendJson(res, 200, {
    roomId,
    playerId: player.id,
    side: player.side,
    hostId: room.hostId,
    hostQuestions: room.hostQuestions,
    selectedMapId: room.selectedMapId,
    matchStarted: room.matchStarted,
    players: snapshot.players
  });
}

function handleLeave(req, res, body) {
  const room = rooms.get(body.roomId);
  if (!room) {
    sendJson(res, 200, { ok: true });
    return;
  }

  room.players = room.players.filter((player) => player.id !== body.playerId);
  delete room.playerHealths[body.playerId];
  delete room.playerGolds[body.playerId];
  delete room.playerBoards[body.playerId];

  const stream = room.streams.get(body.playerId);
  if (stream) {
    stream.end();
    room.streams.delete(body.playerId);
  }

  if (!room.players.length) {
    rooms.delete(room.id);
    sendJson(res, 200, { ok: true });
    return;
  }

  normalizeRoom(room);
  publishRoom(room);
  sendJson(res, 200, { ok: true });
}

function handleRelay(req, res, body) {
  const room = rooms.get(body.roomId);
  if (!room) {
    sendJson(res, 404, { error: "Room not found." });
    return;
  }

  const sender = getPlayer(room, body.playerId);
  if (!sender) {
    sendJson(res, 403, { error: "Player not in room." });
    return;
  }

  const payload = body.payload || {};
  if (body.type === "host_questions" && sender.id === room.hostId) {
    room.hostQuestions = sanitizeQuestions(payload.questions);
  }
  if (body.type === "select_map" && sender.id === room.hostId) {
    room.selectedMapId = String(payload.mapId || DEFAULT_MAP_ID).trim() || DEFAULT_MAP_ID;
  }
  if (body.type === "lobby_start" && sender.id === room.hostId) {
    room.matchStarted = true;
  }
  if (body.type === "health_update") {
    room.playerHealths[sender.id] = Math.max(0, Math.min(100, Number(payload.hp) || 0));
  }
  if (body.type === "gold_update") {
    room.playerGolds[sender.id] = Math.max(0, Math.round(Number(payload.gold) || 0));
  }
  if (body.type === "board_update") {
    room.playerBoards[sender.id] = payload && typeof payload === "object" ? payload : null;
  }

  const event = {
    type: body.type,
    sender: sender.id,
    target: body.target || null,
    payload
  };

  if (body.type === "host_questions") {
    event.payload = {
      hostId: room.hostId,
      questions: room.hostQuestions
    };
  }

  publish(room, event);
  if (body.type === "health_update" || body.type === "gold_update" || body.type === "board_update" || body.type === "select_map" || body.type === "lobby_start") {
    publishRoom(room);
  }
  sendJson(res, 200, { ok: true });
}

function handleEvents(req, res, url) {
  const roomId = String(url.searchParams.get("roomId") || "").trim().toLowerCase();
  const playerId = String(url.searchParams.get("playerId") || "").trim();
  const room = rooms.get(roomId);

  if (!room || !getPlayer(room, playerId)) {
    sendJson(res, 404, { error: "Room or player not found." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(": connected\n\n");

  room.streams.set(playerId, res);
  publishRoom(room);

  req.on("close", () => {
    room.streams.delete(playerId);
  });
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/lobby.html" : url.pathname;
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/events") {
      handleEvents(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/join") {
      handleJoin(req, res, await readBody(req));
      return;
    }

    if (req.method === "POST" && url.pathname === "/leave") {
      handleLeave(req, res, await readBody(req));
      return;
    }

    if (req.method === "POST" && url.pathname === "/relay") {
      handleRelay(req, res, await readBody(req));
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, url);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Scholar Siege multiplayer server running on http://localhost:${PORT}`);
});
