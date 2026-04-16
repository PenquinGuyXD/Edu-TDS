const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

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
    "Cache-Control": "no-store"
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

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: [],
      streams: new Map()
    });
  }
  return rooms.get(roomId);
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId) || null;
}

function publish(room, event) {
  room.streams.forEach((stream, playerId) => {
    if (event.target && event.target !== playerId) return;
    stream.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

function handleJoin(req, res, body) {
  const roomId = String(body.roomId || "").trim().toLowerCase();
  const name = String(body.name || "Player").trim().slice(0, 24) || "Player";
  if (!roomId) {
    sendJson(res, 400, { error: "Room code is required." });
    return;
  }

  const room = getOrCreateRoom(roomId);
  if (room.players.length >= 2) {
    sendJson(res, 409, { error: "Room is full." });
    return;
  }

  const player = {
    id: randomUUID(),
    name,
    side: room.players.length === 0 ? "host" : "guest"
  };
  room.players.push(player);

  publish(room, {
    type: "room_update",
    roomId,
    players: room.players.map(({ id, name: playerName, side }) => ({ id, name: playerName, side }))
  });

  sendJson(res, 200, {
    roomId,
    playerId: player.id,
    side: player.side,
    players: room.players.map(({ id, name: playerName, side }) => ({ id, name: playerName, side }))
  });
}

function handleLeave(req, res, body) {
  const room = rooms.get(body.roomId);
  if (!room) {
    sendJson(res, 200, { ok: true });
    return;
  }

  room.players = room.players.filter((player) => player.id !== body.playerId);
  const stream = room.streams.get(body.playerId);
  if (stream) {
    stream.end();
    room.streams.delete(body.playerId);
  }

  publish(room, {
    type: "room_update",
    roomId: room.id,
    players: room.players.map(({ id, name, side }) => ({ id, name, side }))
  });

  if (room.players.length === 0) {
    rooms.delete(room.id);
  }

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

  const event = {
    type: body.type,
    sender: sender.id,
    target: body.target || null,
    payload: body.payload || {}
  };

  publish(room, event);
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
  publish(room, {
    type: "room_update",
    roomId,
    players: room.players.map(({ id, name, side }) => ({ id, name, side }))
  });

  req.on("close", () => {
    room.streams.delete(playerId);
  });
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
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

server.listen(PORT, () => {
  console.log(`Scholar Siege multiplayer server running on http://localhost:${PORT}`);
});
