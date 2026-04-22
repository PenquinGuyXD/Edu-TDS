"use strict";

const CUSTOM_QUESTIONS_KEY = "scholar-siege-custom-questions";
const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";
const RR_RESULTS_KEY = "reflect-rumble-results";
const DEFAULT_MATCH_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_RR_DIFFICULTY = "medium";
const ITEM_COOLDOWN_MS = 10_000;

class Question {
  constructor(prompt, options, correctAnswer) {
    this.prompt = prompt;
    this.options = options;
    this.correctAnswer = correctAnswer;
  }
}

const DIFFICULTIES = {
  easy: { label: "Easy", minSpeed: 90, maxSpeed: 130, radius: 54, questionSeconds: 18, wrongPenalty: 60, wrongTimeLoss: 1.1 },
  medium: { label: "Medium", minSpeed: 180, maxSpeed: 275, radius: 44, questionSeconds: 15, wrongPenalty: 95, wrongTimeLoss: 1.7 },
  hard: { label: "Hard", minSpeed: 360, maxSpeed: 560, radius: 34, questionSeconds: 12, wrongPenalty: 130, wrongTimeLoss: 2.3 }
};

const POWER_UPS = {
  inkBomb: { label: "Ink Bomb", short: "Ink", color: "#20272a" },
  shrinkRay: { label: "Shrink Ray", short: "Shrink", color: "#c24c82" },
  speedEnhancer: { label: "Speed Enhancer", short: "Speed", color: "#e7bf35" },
  siphon: { label: "Siphon", short: "Boost", color: "#28a8ba" }
};
const POWER_UP_KEYS = Object.keys(POWER_UPS);
const POWER_UP_DURATIONS = { inkBomb: 4000, shrinkRay: 5500, speedEnhancer: 5500, siphon: 7000 };
const SHRINK_FACTOR = 0.68;
const SPEED_FACTOR = 1.45;
const PICKUP_TTL_MS = 2600;
const GRAVITY = 520;
const ARENA_WIDTH = 760;
const ARENA_HEIGHT = 420;

const FALLBACK_QUESTIONS = [
  new Question("Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], "Mars"),
  new Question("What is 12 x 8?", ["84", "88", "96", "108"], "96"),
  new Question("Which organ pumps blood through the body?", ["Lungs", "Heart", "Liver", "Kidneys"], "Heart"),
  new Question("Who wrote Romeo and Juliet?", ["Jane Austen", "William Shakespeare", "Mark Twain", "Maya Angelou"], "William Shakespeare"),
  new Question("What gas do plants absorb from the air?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], "Carbon dioxide"),
  new Question("Which number is prime?", ["21", "27", "29", "33"], "29"),
  new Question("What is the capital of Japan?", ["Kyoto", "Tokyo", "Osaka", "Seoul"], "Tokyo"),
  new Question("Which force keeps planets in orbit around the Sun?", ["Magnetism", "Friction", "Gravity", "Electricity"], "Gravity")
];

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

function saveSession(session) {
  sessionStorage.setItem(MULTIPLAYER_SESSION_KEY, JSON.stringify(session));
}

function loadCustomQuestions() {
  try {
    const raw = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const prompt = String(entry.question || "").trim();
        const answer = String(entry.answer || "").trim();
        const options = Array.isArray(entry.options) ? entry.options.map((option) => String(option || "").trim()).filter(Boolean) : [];
        if (!prompt || !answer || options.length < 2 || !options.includes(answer)) return null;
        return new Question(prompt, options, answer);
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function saveRRResults(results) {
  sessionStorage.setItem(RR_RESULTS_KEY, JSON.stringify(results));
}

function emptyInventory() {
  return { inkBomb: 0, shrinkRay: 0, speedEnhancer: 0, siphon: 0 };
}

function createEffects() {
  return { inkBomb: { until: 0 }, shrinkRay: { until: 0 }, speedEnhancer: { until: 0 } };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function formatSeconds(seconds) {
  return `${Math.max(0, seconds).toFixed(2)}s`;
}

class QuestionManager {
  constructor() {
    this.questions = FALLBACK_QUESTIONS;
    this.recentPrompts = [];
  }

  setQuestions(questions) {
    this.questions = Array.isArray(questions) && questions.length ? questions : FALLBACK_QUESTIONS;
    this.recentPrompts = [];
  }

  getRandomQuestion() {
    const available = this.questions.filter((question) => !this.recentPrompts.includes(question.prompt));
    const pool = available.length ? available : this.questions;
    const question = pool[Math.floor(Math.random() * pool.length)];
    this.recentPrompts.push(question.prompt);
    if (this.recentPrompts.length > Math.min(5, this.questions.length - 1)) this.recentPrompts.shift();
    return question;
  }
}

class Target {
  constructor(answer, correct, x, y, radius, speed, index) {
    this.answer = answer;
    this.correct = correct;
    this.x = x;
    this.y = y;
    this.radius = radius;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = ["#d84343", "#28a8ba", "#e7bf35", "#c24c82"][index % 4];
  }

  update(delta, width, height) {
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    if (this.x - this.radius < 0) { this.x = this.radius; this.vx = Math.abs(this.vx); }
    else if (this.x + this.radius > width) { this.x = width - this.radius; this.vx = -Math.abs(this.vx); }
    if (this.y - this.radius < 0) { this.y = this.radius; this.vy = Math.abs(this.vy); }
    else if (this.y + this.radius > height) { this.y = height - this.radius; this.vy = -Math.abs(this.vy); }
  }

  contains(x, y) {
    return Math.hypot(this.x - x, this.y - y) <= this.radius;
  }
}

class Pickup {
  constructor(type, width, height) {
    this.type = type;
    this.x = randomBetween(40, Math.max(41, width - 40));
    this.y = height + 26;
    this.radius = 22;
    this.vx = randomBetween(-35, 35);
    this.vy = randomBetween(-440, -340);
    this.spawnedAt = performance.now();
    this.angle = Math.random() * Math.PI * 2;
    this.spin = randomBetween(-2.8, 2.8);
  }

  update(delta, width) {
    this.vy += GRAVITY * delta;
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.angle += this.spin * delta;
    if (this.x - this.radius < 0 || this.x + this.radius > width) {
      this.vx *= -1;
      this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
    }
  }

  isExpired(now, height) {
    return now - this.spawnedAt > PICKUP_TTL_MS || this.y - this.radius > height + 40;
  }

  contains(x, y) {
    return Math.hypot(this.x - x, this.y - y) <= this.radius;
  }
}

const RRMultiplayer = {
  state: {
    connected: false,
    roomId: "",
    playerId: "",
    playerName: "",
    hostId: "",
    selectedGameId: "",
    matchStarted: false,
    matchStartAt: null,
    matchDurationMs: DEFAULT_MATCH_DURATION_MS,
    rrDifficulty: DEFAULT_RR_DIFFICULTY,
    rrPowerupsEnabled: true,
    players: [],
    hostQuestions: [],
    eventSource: null
  },
  async init() {
    const session = loadSession();
    if (!session?.roomId || !session?.playerId) return;
    try {
      const response = await fetch(apiPath("/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: session.roomId,
          name: session.name,
          playerId: session.playerId
        })
      });
      const payload = await response.json();
      if (!response.ok) return;
      this.state.connected = true;
      this.state.roomId = payload.roomId;
      this.state.playerId = payload.playerId;
      this.state.playerName = session.name;
      this.applySnapshot(payload);
      saveSession({ roomId: payload.roomId, playerId: payload.playerId, name: session.name });
      this.openEventStream();
    } catch (error) {
      this.state.connected = false;
    }
  },
  openEventStream() {
    if (this.state.eventSource) this.state.eventSource.close();
    const url = `${apiPath("/events")}?roomId=${encodeURIComponent(this.state.roomId)}&playerId=${encodeURIComponent(this.state.playerId)}`;
    this.state.eventSource = new EventSource(url);
    this.state.eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleEvent(message);
    };
  },
  applySnapshot(snapshot) {
    this.state.hostId = snapshot.hostId || "";
    this.state.players = Array.isArray(snapshot.players) ? snapshot.players : [];
    this.state.selectedGameId = snapshot.selectedGameId || "";
    this.state.matchStarted = Boolean(snapshot.matchStarted);
    this.state.matchStartAt = Number(snapshot.matchStartAt || 0) || null;
    this.state.matchDurationMs = Number(snapshot.matchDurationMs || DEFAULT_MATCH_DURATION_MS) || DEFAULT_MATCH_DURATION_MS;
    this.state.rrDifficulty = String(snapshot.rrDifficulty || DEFAULT_RR_DIFFICULTY);
    this.state.rrPowerupsEnabled = snapshot.rrPowerupsEnabled !== false;
    this.state.hostQuestions = Array.isArray(snapshot.hostQuestions) ? snapshot.hostQuestions : [];
  },
  handleEvent(message) {
    if (message.type === "room_update") {
      const wasStarted = this.state.matchStarted;
      this.applySnapshot(message);
      game.applyQuestionBank();
      game.updateHud();
      if (!wasStarted && this.state.matchStarted && this.state.selectedGameId === "reflect-rumble") {
        game.startGame(true);
      }
      return;
    }
    if (message.type === "rr_item" && message.target === this.state.playerId) {
      game.applyRemoteItem(message.payload);
      return;
    }
    if (message.type === "rr_siphon_gain" && message.target === this.state.playerId) {
      game.losePointsFromOpponent(Number(message.payload?.amount || 0), message.payload?.senderName || "Opponent");
      return;
    }
  },
  getOpponent() {
    return this.state.players.find((player) => player.id !== this.state.playerId) || null;
  },
  getOpponentPoints() {
    return Number(this.getOpponent()?.stats?.points || this.getOpponent()?.board?.points || 0);
  },
  getMatchSecondsRemaining() {
    if (!this.state.connected || !this.state.matchStartAt) return 0;
    const remainingMs = (this.state.matchStartAt + this.state.matchDurationMs) - Date.now();
    return Math.max(0, remainingMs / 1000);
  },
  async relay(type, payload, target = null) {
    if (!this.state.connected) return;
    await fetch(apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type,
        target,
        payload
      })
    }).catch(() => {});
  },
  async reportStats(stats, board) {
    if (!this.state.connected) return;
    await this.relay("rr_stats", stats);
    await this.relay("board_update", board);
  },
  async sendItem(type) {
    const opponent = this.getOpponent();
    if (!opponent) return;
    await this.relay("rr_item", { type, senderName: this.state.playerName }, opponent.id);
  },
  async siphonTransfer(amount) {
    const opponent = this.getOpponent();
    if (!opponent || amount <= 0) return;
    await this.relay("rr_siphon_gain", { amount, senderName: this.state.playerName }, opponent.id);
  }
};

class ReflectRumbleGame {
  constructor() {
    this.questionManager = new QuestionManager();
    this.round = 0;
    this.maxRounds = 5;
    this.question = null;
    this.difficultyKey = DEFAULT_RR_DIFFICULTY;
    this.difficulty = DIFFICULTIES[this.difficultyKey];
    this.powerUpsEnabled = true;
    this.roundEndsAt = 0;
    this.roundTimer = 0;
    this.phase = "menu";
    this.lastTime = 0;
    this.animationId = null;
    this.nextRoundTimer = null;
    this.countdownTimer = null;
    this.countdownValue = 0;
    this.resultsRedirected = false;
    this.player = {
      score: 0,
      inventory: emptyInventory(),
      effects: createEffects(),
      board: null,
      siphonBoostUntil: 0,
      itemCooldownUntil: 0,
      shots: 0,
      misses: 0,
      roundsPlayed: 0,
      roundsCorrect: 0
    };
    this.elements = {
      gameScreen: document.getElementById("game-screen"),
      overScreen: document.getElementById("game-over-screen"),
      offlineStartButton: document.getElementById("offlineStartButton"),
      returnLobbyInlineBtn: document.getElementById("return-lobby-inline-btn"),
      exitBtn: document.getElementById("exit-btn"),
      difficultyDisplay: document.getElementById("difficulty-display"),
      roundDisplay: document.getElementById("round-display"),
      timerDisplay: document.getElementById("timer-display"),
      pointsDisplay: document.getElementById("points-display"),
      opponentPointsDisplay: document.getElementById("opponent-points-display"),
      powerupState: document.getElementById("powerup-state"),
      arenaGrid: document.getElementById("arena-grid"),
      feedback: document.getElementById("feedback"),
      gameOverTitle: document.getElementById("game-over-title"),
      finalScore: document.getElementById("final-score"),
      bestScore: document.getElementById("best-score"),
      restartBtn: document.getElementById("restart-btn"),
      menuBtn: document.getElementById("menu-btn"),
      multiplayerBanner: document.getElementById("multiplayer-banner")
    };
    this.bindEvents();
    this.applyQuestionBank();
    this.updateHud();
  }

  async init() {
    await RRMultiplayer.init();
    this.applyRoomSettings();
    this.applyQuestionBank();
    this.showScreen("game");
    if (RRMultiplayer.state.connected && RRMultiplayer.state.selectedGameId === "reflect-rumble") {
      this.elements.multiplayerBanner.classList.remove("hidden");
      this.elements.offlineStartButton?.classList.add("hidden");
      this.elements.returnLobbyInlineBtn?.classList.add("hidden");
      this.elements.multiplayerBanner.textContent = RRMultiplayer.state.matchStarted
        ? `Room ${RRMultiplayer.state.roomId.toUpperCase()} live`
        : `Waiting for the host to start room ${RRMultiplayer.state.roomId.toUpperCase()}`;
      if (RRMultiplayer.state.matchStarted) {
        this.startGame(true);
      } else {
        this.setFeedback("Waiting for the host to start the match.", "info");
      }
    } else {
      this.elements.multiplayerBanner.classList.add("hidden");
      this.powerUpsEnabled = false;
      this.elements.offlineStartButton?.classList.remove("hidden");
      this.elements.returnLobbyInlineBtn?.classList.remove("hidden");
      this.setFeedback("Press Start Match to begin.", "info");
    }
    this.updateHud();
  }

  bindEvents() {
    this.elements.offlineStartButton?.addEventListener("click", () => this.startGame(false));
    this.elements.restartBtn.addEventListener("click", () => this.startGame(false));
    this.elements.menuBtn.addEventListener("click", () => this.returnToLobby());
    this.elements.returnLobbyInlineBtn.addEventListener("click", () => this.returnToLobby());
    this.elements.exitBtn.addEventListener("click", () => {
      this.elements.exitBtn.textContent = "Close the browser tab to exit";
      window.setTimeout(() => { this.elements.exitBtn.textContent = "Exit"; }, 1800);
    });
  }

  returnToLobby() {
      window.location.href = "lobby.html";
  }

  applyRoomSettings() {
    if (!RRMultiplayer.state.connected) {
      this.powerUpsEnabled = false;
      return;
    }
    this.difficultyKey = RRMultiplayer.state.rrDifficulty || DEFAULT_RR_DIFFICULTY;
    this.difficulty = DIFFICULTIES[this.difficultyKey] || DIFFICULTIES[DEFAULT_RR_DIFFICULTY];
    this.powerUpsEnabled = RRMultiplayer.state.rrPowerupsEnabled !== false;
  }

  applyQuestionBank() {
    if (RRMultiplayer.state.connected && RRMultiplayer.state.hostQuestions.length) {
      const roomQuestions = RRMultiplayer.state.hostQuestions
        .map((entry) => new Question(entry.question, entry.options, entry.answer))
        .filter((entry) => entry.prompt && entry.options?.length);
      this.questionManager.setQuestions(roomQuestions);
      return;
    }
    const custom = loadCustomQuestions();
    this.questionManager.setQuestions(custom.length ? custom : FALLBACK_QUESTIONS);
  }

  startGame(forceMultiplayerStart) {
    if (RRMultiplayer.state.connected && !RRMultiplayer.state.matchStarted && !forceMultiplayerStart) return;
    this.clearTimers();
    this.resultsRedirected = false;
    this.showScreen("game");
    if (RRMultiplayer.state.connected) {
      this.elements.offlineStartButton?.classList.add("hidden");
      this.elements.returnLobbyInlineBtn?.classList.add("hidden");
    } else {
      this.elements.offlineStartButton?.classList.add("hidden");
      this.elements.returnLobbyInlineBtn?.classList.remove("hidden");
    }
    if (!RRMultiplayer.state.connected) {
      this.phase = "game";
      this.powerUpsEnabled = false;
    } else {
      this.applyRoomSettings();
      this.elements.multiplayerBanner.classList.remove("hidden");
      this.elements.multiplayerBanner.textContent = `${RRMultiplayer.state.roomId.toUpperCase()} | ${RRMultiplayer.state.playerName}`;
      this.phase = "countdown";
    }
    this.player.score = 0;
    this.player.inventory = emptyInventory();
    this.player.effects = createEffects();
    this.player.siphonBoostUntil = 0;
    this.player.itemCooldownUntil = 0;
    this.player.shots = 0;
    this.player.misses = 0;
    this.player.roundsPlayed = 0;
    this.player.roundsCorrect = 0;
    this.round = 0;
    if (RRMultiplayer.state.connected) {
      this.startCountdown(5);
    } else {
      this.startNextRound();
      this.startLoop();
    }
  }

  startCountdown(seconds) {
    this.clearTimers();
    this.countdownValue = seconds;
    this.player.board = null;
    this.elements.arenaGrid.innerHTML = "";
    this.setFeedback(`Match starts in ${this.countdownValue}`, "info");
    this.updateHud();
    this.countdownTimer = window.setInterval(() => {
      this.countdownValue -= 1;
      if (this.countdownValue <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.phase = "game";
        this.startNextRound();
        this.startLoop();
        return;
      }
      this.setFeedback(`Match starts in ${this.countdownValue}`, "info");
      this.updateHud();
    }, 1000);
  }

  showScreen(name) {
    this.elements.gameScreen.classList.remove("active");
    this.elements.overScreen.classList.remove("active");
    if (name === "game") this.elements.gameScreen.classList.add("active");
    if (name === "over") this.elements.overScreen.classList.add("active");
  }

  startNextRound() {
    if (RRMultiplayer.state.connected) {
      if (RRMultiplayer.getMatchSecondsRemaining() <= 0) {
        this.finishMultiplayerMatch();
        return;
      }
    } else if (this.round >= this.maxRounds) {
      this.endGame();
      return;
    }
    this.round += 1;
    this.question = this.questionManager.getRandomQuestion();
    const now = performance.now();
    this.roundEndsAt = now + this.difficulty.questionSeconds * 1000;
    this.player.board = this.createBoardState(now);
    this.renderArenaBoard();
    this.setFeedback("Hit the correct answer and collect power-ups.", "info");
    this.updateHud();
    this.reportStats();
  }

  createBoardState(now) {
    return {
      targets: this.createTargets(this.getCurrentRadius(), ARENA_WIDTH, ARENA_HEIGHT),
      pickups: [],
      answered: false,
      statusText: "Active",
      nextPickupAt: this.powerUpsEnabled ? now + randomBetween(3600, 6200) : Infinity,
      canvas: null,
      context: null,
      width: ARENA_WIDTH,
      height: ARENA_HEIGHT,
      toolbarButtons: {},
      statusNode: null,
      timerBar: null,
      promptNode: null,
      roundNode: null
    };
  }

  createTargets(radius, width, height) {
    const targets = [];
    this.question.options.forEach((answer, index) => {
      let x = radius + randomBetween(0, width - radius * 2);
      let y = radius + randomBetween(0, height - radius * 2);
      for (let attempts = 0; attempts < 100; attempts += 1) {
        if (targets.every((target) => Math.hypot(target.x - x, target.y - y) >= radius * 2 + 12)) break;
        x = radius + randomBetween(0, width - radius * 2);
        y = radius + randomBetween(0, height - radius * 2);
      }
      const speed = randomBetween(this.getCurrentMinSpeed(), this.getCurrentMaxSpeed());
      targets.push(new Target(answer, answer === this.question.correctAnswer, x, y, radius, speed, index));
    });
    return targets;
  }

  getCurrentRadius() {
    return this.player.effects.shrinkRay.until > performance.now()
      ? Math.max(20, Math.round(this.difficulty.radius * SHRINK_FACTOR))
      : this.difficulty.radius;
  }

  getCurrentMinSpeed() {
    return this.player.effects.speedEnhancer.until > performance.now()
      ? Math.round(this.difficulty.minSpeed * SPEED_FACTOR)
      : this.difficulty.minSpeed;
  }

  getCurrentMaxSpeed() {
    return this.player.effects.speedEnhancer.until > performance.now()
      ? Math.round(this.difficulty.maxSpeed * SPEED_FACTOR)
      : this.difficulty.maxSpeed;
  }

  renderArenaBoard() {
    this.elements.arenaGrid.replaceChildren();
    const board = this.player.board;
    const card = document.createElement("article");
    card.className = "arena-card";

    const header = document.createElement("div");
    header.className = "arena-header";
    const name = document.createElement("strong");
    name.className = "arena-player";
    name.textContent = RRMultiplayer.state.connected ? (RRMultiplayer.state.playerName || "You") : "Solo Run";
    const score = document.createElement("span");
    score.className = "score-tag";
    score.textContent = `${this.player.score} pts`;
    header.append(name, score);

    const status = document.createElement("p");
    status.className = "arena-status";
    status.textContent = board ? board.statusText : "Waiting";

    const questionWrap = document.createElement("div");
    questionWrap.className = "arena-question";
    const round = document.createElement("p");
    round.className = "arena-round";
    round.textContent = `Round ${this.round || 1}${RRMultiplayer.state.connected ? "" : ` of ${this.maxRounds}`}`;
    const prompt = document.createElement("h3");
    prompt.className = "arena-prompt";
    prompt.textContent = this.question ? this.question.prompt : "Question";
    const timerTrack = document.createElement("div");
    timerTrack.className = "arena-timer-track";
    const timerBar = document.createElement("div");
    timerBar.className = "arena-timer-bar";
    timerTrack.appendChild(timerBar);
    questionWrap.append(round, prompt, timerTrack);

    const canvas = document.createElement("canvas");
    canvas.className = "arena-canvas";
    canvas.width = board ? board.width : ARENA_WIDTH;
    canvas.height = board ? board.height : ARENA_HEIGHT;
    canvas.addEventListener("click", (event) => this.handleBoardClick(event));

    const toolbar = document.createElement("div");
    toolbar.className = "arena-toolbar";
    toolbar.classList.toggle("hidden", !RRMultiplayer.state.connected);
    const powerRow = document.createElement("div");
    powerRow.className = "arena-powerups";
    const buttons = {};
    POWER_UP_KEYS.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `arena-power-btn${this.player.inventory[key] > 0 ? " ready" : ""}`;
      button.addEventListener("click", () => this.usePowerUp(key));
      const title = document.createElement("strong");
      title.textContent = POWER_UPS[key].label;
      const detail = document.createElement("span");
      detail.textContent = `${this.player.inventory[key]} stored`;
      button.append(title, detail);
      powerRow.appendChild(button);
      buttons[key] = { button, detail };
    });
    toolbar.append(powerRow);
    card.append(header, status, questionWrap, canvas, toolbar);
    this.elements.arenaGrid.appendChild(card);

    if (board) {
      board.canvas = canvas;
      board.context = canvas.getContext("2d");
      board.toolbarButtons = buttons;
      board.statusNode = status;
      board.timerBar = timerBar;
      board.roundNode = round;
      board.promptNode = prompt;
    }
  }

  handleBoardClick(event) {
    if (this.phase !== "game") return;
    const board = this.player.board;
    if (!board || board.answered) return;
    const rect = board.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (board.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (board.canvas.height / rect.height);
    const pickup = [...board.pickups].reverse().find((item) => item.contains(x, y));
    if (pickup) {
      board.pickups = board.pickups.filter((item) => item !== pickup);
      this.player.inventory[pickup.type] += 1;
      this.setFeedback(`You grabbed ${POWER_UPS[pickup.type].label}.`, "info");
      this.renderArenaBoard();
      this.reportStats();
      return;
    }

    this.player.shots += 1;
    const target = [...board.targets].reverse().find((item) => item.contains(x, y));
    if (!target) {
      this.player.misses += 1;
      this.player.score = Math.max(0, this.player.score - 25);
      board.statusText = "Missed shot";
      this.setFeedback("Missed shot. -25", "incorrect");
      this.reportStats();
      return;
    }
    if (target.correct) {
      this.completeBoard(x, y);
    } else {
      this.player.misses += 1;
      this.player.score = Math.max(0, this.player.score - this.difficulty.wrongPenalty);
      this.roundEndsAt -= this.difficulty.wrongTimeLoss * 1000;
      board.statusText = "Wrong target";
      this.setFeedback(`Wrong target. -${this.difficulty.wrongPenalty}`, "incorrect");
      this.reportStats();
    }
  }

  async usePowerUp(type) {
    const board = this.player.board;
    if (!this.powerUpsEnabled || this.phase !== "game" || !board || board.answered || this.player.inventory[type] <= 0) return;
    const refs = board.toolbarButtons?.[type];
    if (performance.now() < this.player.itemCooldownUntil) {
      refs?.button.classList.add("cooldown-hit");
      window.setTimeout(() => refs?.button.classList.remove("cooldown-hit"), 280);
      return;
    }
    this.player.inventory[type] -= 1;
    this.player.itemCooldownUntil = performance.now() + ITEM_COOLDOWN_MS;
    const until = performance.now() + POWER_UP_DURATIONS[type];
    if (type === "inkBomb") {
      this.player.effects.inkBomb.until = until;
      this.setFeedback("Ink Bomb active.", "info");
    } else if (type === "siphon") {
      this.player.siphonBoostUntil = until;
      this.setFeedback("Siphon active.", "info");
    } else if (RRMultiplayer.state.connected) {
      await RRMultiplayer.sendItem(type);
      this.setFeedback(`${POWER_UPS[type].label} sent to your opponent.`, "info");
    } else if (type === "shrinkRay") {
      this.player.effects.shrinkRay.until = until;
      board.targets.forEach((target) => { target.radius = Math.max(20, target.radius * SHRINK_FACTOR); });
      this.setFeedback("Shrink Ray active.", "info");
    } else if (type === "speedEnhancer") {
      this.player.effects.speedEnhancer.until = until;
      board.targets.forEach((target) => { target.vx *= SPEED_FACTOR; target.vy *= SPEED_FACTOR; });
      this.setFeedback("Speed Enhancer active.", "info");
    }
    this.renderArenaBoard();
    this.reportStats();
  }

  applyRemoteItem(payload) {
    const type = payload?.type;
    const board = this.player.board;
    if (!board || board.answered) return;
    const until = performance.now() + POWER_UP_DURATIONS[type];
    if (type === "shrinkRay") {
      this.player.effects.shrinkRay.until = until;
      board.targets.forEach((target) => { target.radius = Math.max(20, target.radius * SHRINK_FACTOR); });
    } else if (type === "speedEnhancer") {
      this.player.effects.speedEnhancer.until = until;
      board.targets.forEach((target) => { target.vx *= SPEED_FACTOR; target.vy *= SPEED_FACTOR; });
    }
    this.setFeedback(`${payload?.senderName || "Opponent"} used ${POWER_UPS[type]?.label || "an item"} on you.`, "incorrect");
  }

  losePointsFromOpponent(amount, senderName) {
    const delta = Math.max(0, Math.round(amount || 0));
    if (!delta) return;
    this.player.score = Math.max(0, this.player.score - delta);
    this.setFeedback(`${senderName} siphoned ${delta} points.`, "incorrect");
    this.reportStats();
  }

  releaseExpiredEffects(now) {
    const board = this.player.board;
    if (!board) return;
    if (this.player.effects.shrinkRay.until && now > this.player.effects.shrinkRay.until) {
      board.targets.forEach((target) => { target.radius = Math.min(this.difficulty.radius, target.radius / SHRINK_FACTOR); });
      this.player.effects.shrinkRay.until = 0;
    }
    if (this.player.effects.speedEnhancer.until && now > this.player.effects.speedEnhancer.until) {
      board.targets.forEach((target) => { target.vx /= SPEED_FACTOR; target.vy /= SPEED_FACTOR; });
      this.player.effects.speedEnhancer.until = 0;
    }
    if (this.player.effects.inkBomb.until && now > this.player.effects.inkBomb.until) this.player.effects.inkBomb.until = 0;
    if (this.player.siphonBoostUntil && now > this.player.siphonBoostUntil) this.player.siphonBoostUntil = 0;
  }

  async completeBoard(shotX, shotY) {
    const board = this.player.board;
    if (!board || board.answered) return;
    board.answered = true;
    this.player.roundsPlayed += 1;
    this.player.roundsCorrect += 1;
    const correctTarget = board.targets.find((item) => item.correct);
    const distance = Math.hypot(correctTarget.x - shotX, correctTarget.y - shotY);
    const accuracy = Math.max(0, 1 - distance / correctTarget.radius);
    const timeRemaining = Math.max(0, this.roundEndsAt - performance.now()) / 1000;
    const speedBonus = Math.round(500 * (timeRemaining / this.difficulty.questionSeconds));
    const centerBonus = Math.round(650 * accuracy * accuracy);
    let points = 500 + speedBonus + centerBonus;
    if (this.player.siphonBoostUntil > performance.now()) {
      await RRMultiplayer.siphonTransfer(points);
    }
    this.player.score += points;
    board.statusText = `Correct +${points}`;
    this.setFeedback(`Correct! +${points}`, "correct");
    this.reportStats();
  }

  update(delta) {
    if (this.phase !== "game") return;
    const now = performance.now();
    if (RRMultiplayer.state.connected && RRMultiplayer.getMatchSecondsRemaining() <= 0) {
      this.finishMultiplayerMatch();
      return;
    }
    this.roundTimer = Math.max(0, (this.roundEndsAt - now) / 1000);
    this.releaseExpiredEffects(now);
    const board = this.player.board;
    if (board && !board.answered) {
      board.targets.forEach((target) => target.update(delta, board.canvas ? board.canvas.width : board.width, board.canvas ? board.canvas.height : board.height));
      board.pickups.forEach((pickup) => pickup.update(delta, board.canvas ? board.canvas.width : board.width));
      board.pickups = board.pickups.filter((pickup) => !pickup.isExpired(now, board.canvas ? board.canvas.height : board.height));
      if (this.powerUpsEnabled && now >= board.nextPickupAt) {
        board.pickups.push(new Pickup(POWER_UP_KEYS[Math.floor(Math.random() * POWER_UP_KEYS.length)], board.canvas ? board.canvas.width : board.width, board.canvas ? board.canvas.height : board.height));
        board.nextPickupAt = now + randomBetween(4200, 7600);
      }
    }
    if (this.roundTimer <= 0 || (board && board.answered)) this.finishRound();
    this.updateHud();
    this.renderArena();
  }

  finishRound() {
    if (this.nextRoundTimer) return;
    const board = this.player.board;
    if (board && !board.answered) {
      this.player.roundsPlayed += 1;
      board.statusText = `Time. Correct: ${this.question.correctAnswer}`;
      this.reportStats();
    }
    this.setFeedback(`Round ${this.round} complete.`, "info");
    this.nextRoundTimer = window.setTimeout(() => {
      this.nextRoundTimer = null;
      this.startNextRound();
    }, 1400);
  }

  renderArena() {
    const board = this.player.board;
    if (!board || !board.context) return;
    const ctx = board.context;
    const width = board.canvas.width;
    const height = board.canvas.height;
    board.statusNode.textContent = board.statusText;
    board.roundNode.textContent = `Round ${this.round}${RRMultiplayer.state.connected ? "" : ` of ${this.maxRounds}`}`;
    board.promptNode.textContent = this.question.prompt;
    const percent = this.difficulty.questionSeconds ? this.roundTimer / this.difficulty.questionSeconds : 0;
    board.timerBar.style.width = `${Math.max(0, percent * 100)}%`;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#254d52");
    gradient.addColorStop(0.46, "#32656a");
    gradient.addColorStop(0.47, "#55775f");
    gradient.addColorStop(1, "#385741");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    board.targets.forEach((target) => drawTarget(ctx, target));
    board.pickups.forEach((pickup) => drawPickup(ctx, pickup));
    if (this.player.effects.inkBomb.until > performance.now()) drawInk(ctx, width, height);
    Object.entries(board.toolbarButtons).forEach(([key, refs]) => {
      refs.button.disabled = !this.powerUpsEnabled || board.answered || this.player.inventory[key] <= 0;
      const readyClass = this.player.inventory[key] > 0 ? " ready" : "";
      refs.button.className = `arena-power-btn${readyClass}`;
      refs.detail.textContent = performance.now() < this.player.itemCooldownUntil
        ? `${this.player.inventory[key]} stored | ${formatSeconds((this.player.itemCooldownUntil - performance.now()) / 1000)}`
        : `${this.player.inventory[key]} stored`;
    });
  }

  updateHud() {
    this.elements.difficultyDisplay.textContent = this.difficulty.label;
    this.elements.roundDisplay.textContent = String(this.round || 1);
    this.elements.timerDisplay.textContent = RRMultiplayer.state.connected
      ? (this.phase === "countdown" ? `${this.countdownValue}s` : formatMatchClock(RRMultiplayer.getMatchSecondsRemaining()))
      : `${Math.ceil(this.roundTimer || this.difficulty.questionSeconds)}s`;
    this.elements.pointsDisplay.textContent = String(this.player.score);
    this.elements.opponentPointsDisplay.textContent = String(RRMultiplayer.getOpponentPoints());
    this.elements.powerupState.textContent = RRMultiplayer.state.connected ? (this.powerUpsEnabled ? "Enabled" : "Disabled") : "Off";
  }

  setFeedback(message, tone) {
    this.elements.feedback.textContent = message;
    this.elements.feedback.className = `feedback ${tone || ""}`.trim();
  }

  getStatsPayload() {
    return {
      points: this.player.score,
      shots: this.player.shots,
      misses: this.player.misses,
      roundsPlayed: this.player.roundsPlayed,
      roundsCorrect: this.player.roundsCorrect
    };
  }

  buildBoardSnapshot() {
    return {
      points: this.player.score,
      round: this.round
    };
  }

  reportStats() {
    if (!RRMultiplayer.state.connected) return;
    RRMultiplayer.reportStats(this.getStatsPayload(), this.buildBoardSnapshot());
  }

  finishMultiplayerMatch() {
    if (this.resultsRedirected) return;
    this.resultsRedirected = true;
    this.clearTimers();
    this.stopLoop();
    const players = RRMultiplayer.state.players.map((player) => ({
      ...player,
      stats: player.id === RRMultiplayer.state.playerId
        ? { ...(player.stats || {}), ...this.getStatsPayload() }
        : player.stats
    }));
    saveRRResults({
      roomId: RRMultiplayer.state.roomId,
      playerId: RRMultiplayer.state.playerId,
      players
    });
    window.location.href = "reflect-rumble-results.html";
  }

  endGame() {
    if (this.resultsRedirected) return;
    this.resultsRedirected = true;
    this.clearTimers();
    this.stopLoop();
    this.phase = "over";
    const bestKey = `reflect-rumble-best-${this.difficultyKey}`;
    const previousBest = Number(localStorage.getItem(bestKey) || 0);
    const best = Math.max(previousBest, this.player.score);
    localStorage.setItem(bestKey, String(best));
    saveRRResults({
      roomId: "solo",
      playerId: "solo-player",
      players: [{
        id: "solo-player",
        name: "Solo Run",
        side: "solo",
        stats: this.getStatsPayload(),
        board: this.buildBoardSnapshot(),
        best
      }]
    });
    window.location.href = "reflect-rumble-results.html";
  }

  startLoop() {
    this.stopLoop();
    this.lastTime = performance.now();
    const tick = (time) => {
      const delta = Math.min(0.033, (time - this.lastTime) / 1000);
      this.lastTime = time;
      this.update(delta);
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  clearTimers() {
    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
      this.nextRoundTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}

function formatMatchClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function drawTarget(ctx, target) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(target.x + 6, target.y + 8, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = target.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke();
  ctx.fillStyle = target.color === "#e7bf35" ? "#172022" : "#ffffff";
  ctx.font = `800 ${Math.max(11, Math.round(target.radius * 0.32))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapCanvasText(ctx, target.answer, target.x, target.y, target.radius * 1.55, Math.max(12, target.radius * 0.34));
  ctx.restore();
}

function drawPickup(ctx, pickup) {
  const info = POWER_UPS[pickup.type];
  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  ctx.rotate(pickup.angle);
  ctx.beginPath();
  ctx.arc(0, 0, pickup.radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, pickup.radius, 0, Math.PI * 2);
  ctx.fillStyle = info.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.86)";
  ctx.stroke();
  ctx.rotate(-pickup.angle);
  ctx.fillStyle = info.color === "#e7bf35" ? "#172022" : "#ffffff";
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapCanvasText(ctx, info.short, 0, 0, pickup.radius * 1.4, 11);
  ctx.restore();
}

function drawInk(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(8, 11, 14, 0.52)";
  ctx.fillRect(0, 0, width, height);
  const blobs = [[0.18, 0.24, 68], [0.32, 0.62, 82], [0.52, 0.3, 94], [0.68, 0.58, 74], [0.84, 0.2, 56]];
  blobs.forEach(([rx, ry, r]) => {
    ctx.beginPath();
    ctx.arc(width * rx, height * ry, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12,16,18,0.88)";
    ctx.fill();
  });
  ctx.restore();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((lineText, index) => ctx.fillText(lineText, x, startY + index * lineHeight));
}

const game = new ReflectRumbleGame();

document.addEventListener("DOMContentLoaded", async () => {
  await game.init();
});
