const CUSTOM_QUESTIONS_KEY = "scholar-siege-custom-questions";
const MULTIPLAYER_SESSION_KEY = "scholar-siege-room-session";

function getCustomQuestions() {
  try {
    const raw = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function loadQuestionBank() {
  return getCustomQuestions();
}

let questions = loadQuestionBank();

function loadMultiplayerSession() {
  try {
    const raw = sessionStorage.getItem(MULTIPLAYER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.roomId || !parsed.name) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveMultiplayerSession(session) {
  sessionStorage.setItem(MULTIPLAYER_SESSION_KEY, JSON.stringify(session));
}

function clearMultiplayerSession() {
  sessionStorage.removeItem(MULTIPLAYER_SESSION_KEY);
}

function refreshQuestionBank() {
  if (typeof MultiplayerManager !== "undefined" && MultiplayerManager.state.connected) {
    questions = MultiplayerManager.getQuestionBank();
    return questions;
  }
  questions = loadQuestionBank();
  return questions;
}

function normalizeQuestionContext(context) {
  if (typeof context === "string") {
    return { id: context, suppressReward: false };
  }
  if (context && typeof context === "object") {
    return {
      id: String(context.id || "").trim(),
      suppressReward: Boolean(context.suppressReward)
    };
  }
  return { id: "", suppressReward: false };
}

const towerCatalog = {
  basic: {
    key: "basic", name: "Scout", cost: 60, color: "#58b8ff", damage: 14, range: 118, fireRate: 1.15, projectileSpeed: 360,
    description: "Reliable all-round defense.",
    upgrades: [
      { cost: 40, damage: 22, range: 132, fireRate: 1.02 },
      { cost: 65, damage: 30, range: 146, fireRate: 0.92 },
      { cost: 95, damage: 40, range: 162, fireRate: 0.82 }
    ]
  },
  rapid: {
    key: "rapid", name: "Mini Gunner", cost: 75, color: "#7dff87", damage: 8, range: 108, fireRate: 0.34, projectileSpeed: 430,
    description: "Fast shots shred light targets.",
    upgrades: [
      { cost: 50, damage: 11, range: 118, fireRate: 0.29 },
      { cost: 80, damage: 14, range: 130, fireRate: 0.24 },
      { cost: 120, damage: 18, range: 140, fireRate: 0.2 }
    ]
  },
  heavy: {
    key: "heavy", name: "Heavy Tower", cost: 110, color: "#ff9f66", damage: 36, range: 132, fireRate: 1.75, projectileSpeed: 300,
    description: "Slow, crushing hits for tougher enemies.",
    upgrades: [
      { cost: 80, damage: 48, range: 144, fireRate: 1.58 },
      { cost: 120, damage: 62, range: 154, fireRate: 1.42 },
      { cost: 165, damage: 82, range: 168, fireRate: 1.28 }
    ]
  },
  farm: {
    key: "farm", name: "Farm Tower", cost: 90, color: "#ffd86b", damage: 0, range: 0, fireRate: Infinity, projectileSpeed: 0,
    description: "No damage. Adds +10% question gold each.", farmBonus: 0.1,
    upgrades: [
      { cost: 55, damage: 0, range: 0, fireRate: Infinity, farmBonus: 0.16 },
      { cost: 85, damage: 0, range: 0, fireRate: Infinity, farmBonus: 0.23 },
      { cost: 130, damage: 0, range: 0, fireRate: Infinity, farmBonus: 0.32 }
    ]
  },
  sniper: {
    key: "sniper", name: "Sniper Tower", cost: 160, color: "#f4f7ff", damage: 95, range: 360, fireRate: 2.7, projectileSpeed: 620,
    description: "Huge range, huge damage, very slow fire rate.",
    upgrades: [
      { cost: 110, damage: 128, range: 420, fireRate: 2.45 },
      { cost: 160, damage: 170, range: 470, fireRate: 2.2 },
      { cost: 230, damage: 220, range: 520, fireRate: 1.95 }
    ]
  }
};

const abilityCatalog = {
  bomb: { cooldown: 18 },
  freeze: { cooldown: 24, duration: 4 }
};

const multiplayerEnemyCatalog = {
  basic: { label: "Scout Rush", cost: 35, count: 3 },
  fast: { label: "Speedsters", cost: 55, count: 3 },
  tank: { label: "Tank Drop", cost: 90, count: 1 }
};

const MAPS = [
  {
    id: "meadow-pass",
    name: "Meadow Pass",
    description: "A winding grassland route with lots of mid-range tower spots.",
    difficulty: "Balanced",
    pathWidth: 64,
    baseColor: "#233d78",
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
    difficulty: "Harder",
    pathWidth: 60,
    baseColor: "#613930",
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
    difficulty: "Sniper Friendly",
    pathWidth: 68,
    baseColor: "#2c4d63",
    pathOuter: "#7ca4b4",
    pathInner: "#bed7dd",
    points: [
      { x: 0, y: 170 }, { x: 230, y: 170 }, { x: 230, y: 78 }, { x: 454, y: 78 }, { x: 454, y: 266 },
      { x: 670, y: 266 }, { x: 670, y: 430 }, { x: 826, y: 430 }, { x: 826, y: 302 }, { x: 960, y: 302 }
    ]
  }
];

const TOWER_PLACEMENT_RADIUS = 28;

function getCurrentMap() {
  return MAPS.find((map) => map.id === GameState.state.currentMapId) || MAPS[0];
}

function getCurrentPathPoints() {
  return getCurrentMap().points;
}

const GameState = {
  width: 960,
  height: 540,
  baseHp: 100,
  startingGold: 120,
  state: null,
  createInitialState() {
    return {
      hp: this.baseHp,
      gold: this.startingGold,
      wave: 0,
      currentMapId: MAPS[0].id,
      enemies: [],
      towers: [],
      projectiles: [],
      particles: [],
      flashes: [],
      pendingPlacement: null,
      selectedTowerId: null,
      isPaused: false,
      isGameOver: false,
      isQuestionOpen: false,
      isRestartModalOpen: false,
      isPreMatch: false,
      waveInProgress: false,
      autoWaveCountdown: 0,
      questionGate: null,
      lastTime: 0,
      freezeRemaining: 0,
      abilityCooldowns: { bomb: 0, freeze: 0 },
      hoverPoint: { x: 0, y: 0, inside: false },
      spectatedPlayerId: null
    };
  },
  reset() {
    this.state = this.createInitialState();
    refreshQuestionBank();
    WaveManager.reset();
    QuestionManager.reset();
    UIManager.hideRestartModal();
    UIManager.hideGameOver();
    UIManager.hidePreMatch();
    UIManager.updateAll();
    if (typeof MultiplayerManager !== "undefined") MultiplayerManager.reportHealth(true);
    if (typeof MultiplayerManager !== "undefined") MultiplayerManager.reportGold(true);
    if (typeof MultiplayerManager !== "undefined") MultiplayerManager.reportBoard(true);
  },
  getFarmMultiplier() {
    // Economy system: only questions and enemy kills create gold.
    const farms = this.state.towers.filter((tower) => tower.type === "farm");
    const bonus = farms.reduce((sum, tower) => sum + tower.getFarmBonus(), 0);
    return 1 + bonus;
  },
  spendGold(amount) {
    if (this.state.gold < amount) return false;
    this.state.gold -= amount;
    if (typeof MultiplayerManager !== "undefined") MultiplayerManager.reportGold(true);
    return true;
  },
  addGold(amount) {
    this.state.gold += Math.round(amount);
    if (typeof MultiplayerManager !== "undefined") MultiplayerManager.reportGold(true);
  },
  canInteract() {
    return !this.state.isGameOver && !this.state.isQuestionOpen && !this.state.isRestartModalOpen && !this.state.isPreMatch;
  },
  isMultiplayerSpectating() {
    return MultiplayerManager.state.connected && this.state.isGameOver;
  },
  questionPausesGameplay() {
    return !MultiplayerManager.state.connected;
  }
};

class Enemy {
  constructor(config) {
    this.type = config.type;
    this.color = config.color;
    this.radius = config.radius;
    this.maxHealth = config.health;
    this.health = config.health;
    this.speed = config.speed;
    this.reward = Math.round(config.reward);
    this.pathIndex = 0;
    this.progress = 0;
    const path = getCurrentPathPoints();
    this.x = path[0].x;
    this.y = path[0].y;
    this.isAlive = true;
    this.senderName = config.senderName || "";
  }

  update(deltaTime) {
    if (!this.isAlive) return;
    let effectiveSpeed = this.speed;
    if (GameState.state.freezeRemaining > 0) effectiveSpeed *= 0.32;
    const path = getCurrentPathPoints();

    let travel = effectiveSpeed * deltaTime;
    while (travel > 0 && this.pathIndex < path.length - 1) {
      const start = path[this.pathIndex];
      const end = path[this.pathIndex + 1];
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
      const remaining = segmentLength - this.progress;
      if (travel < remaining) {
        this.progress += travel;
        travel = 0;
      } else {
        travel -= remaining;
        this.pathIndex += 1;
        this.progress = 0;
      }
    }

    if (this.pathIndex >= path.length - 1) {
      this.reachBase();
      return;
    }

    const start = path[this.pathIndex];
    const end = path[this.pathIndex + 1];
    const segmentLength = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
    const ratio = this.progress / segmentLength;
    this.x = start.x + (end.x - start.x) * ratio;
    this.y = start.y + (end.y - start.y) * ratio;
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.isAlive = false;
      GameState.addGold(this.reward);
      GameState.state.particles.push(new FloatingText(`+${this.reward}g`, this.x, this.y, "#ffcf5d"));
    }
  }

  reachBase() {
    if (!this.isAlive) return;
    this.isAlive = false;
    const damage = Math.max(1, Math.ceil(this.health));
    GameState.state.hp = Math.max(0, GameState.state.hp - damage);
    GameState.state.particles.push(new FloatingText(`-${damage} HP`, this.x, this.y, "#ff8a8a"));
    if (GameState.state.hp <= 0) {
      GameState.state.isGameOver = true;
      GameState.state.waveInProgress = false;
      if (MultiplayerManager.state.connected) {
        const fallbackPlayer = MultiplayerManager.state.players.find((player) => player.id !== MultiplayerManager.state.playerId && MultiplayerManager.state.boards[player.id]);
        GameState.state.spectatedPlayerId = fallbackPlayer?.id || MultiplayerManager.state.playerId || null;
      }
      const summary = MultiplayerManager.state.connected
        ? "Your base fell. You are now spectating the rest of the room."
        : `Wave ${GameState.state.wave} overwhelmed the base.`;
      UIManager.showGameOver(summary);
    }
    if (typeof MultiplayerManager !== "undefined") MultiplayerManager.reportHealth(true);
  }

  draw(ctx) {
    if (!this.isAlive) return;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();

    const barWidth = this.radius * 2.3;
    const healthRatio = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 12, barWidth, 6);
    ctx.fillStyle = "#57e389";
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 12, barWidth * healthRatio, 6);

    if (this.senderName) {
      ctx.fillStyle = "rgba(4, 8, 15, 0.72)";
      ctx.fillRect(this.x - 46, this.y - this.radius - 28, 92, 12);
      ctx.fillStyle = "#ffcf5d";
      ctx.font = "bold 10px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(this.senderName, this.x, this.y - this.radius - 18);
    }
    ctx.restore();
  }
}

class Projectile {
  constructor(x, y, target, damage, speed, color) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.color = color;
    this.active = true;
  }

  update(deltaTime) {
    if (!this.active || !this.target || !this.target.isAlive) {
      this.active = false;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * deltaTime;
    if (dist <= Math.max(6, step)) {
      this.target.takeDamage(this.damage);
      GameState.state.flashes.push(new ImpactPulse(this.target.x, this.target.y, this.color));
      this.active = false;
      return;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x - 6, this.y - 6);
    ctx.lineTo(this.x + 6, this.y + 6);
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(text, x, y, color) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 1.1;
  }

  update(deltaTime) {
    this.life -= deltaTime;
    this.y -= 24 * deltaTime;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.font = "bold 16px Segoe UI";
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class ShotFlash {
  constructor(x, y, tx, ty, color) {
    this.x = x;
    this.y = y;
    this.tx = tx;
    this.ty = ty;
    this.color = color;
    this.life = 0.12;
  }

  update(deltaTime) {
    this.life -= deltaTime;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / 0.12);
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.tx, this.ty);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff4c7";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ImpactPulse {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 0.18;
  }

  update(deltaTime) {
    this.life -= deltaTime;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / 0.18);
    const radius = 8 + (1 - alpha) * 12;
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class Tower {
  constructor(type, x, y) {
    const data = towerCatalog[type];
    this.id = `tower-${Math.random().toString(36).slice(2, 9)}`;
    this.type = type;
    this.name = data.name;
    this.x = x;
    this.y = y;
    this.color = data.color;
    this.level = 0;
    this.stats = {
      damage: data.damage,
      range: data.range,
      fireRate: data.fireRate,
      projectileSpeed: data.projectileSpeed,
      farmBonus: data.farmBonus || 0
    };
    this.cost = data.cost;
    this.timeSinceShot = 0;
    this.radius = 20;
  }
 
  update(deltaTime) {
    if (this.type === "farm") return;
    this.timeSinceShot += deltaTime;
    const target = this.findTarget();
    if (!target) return;
    if (this.timeSinceShot >= this.stats.fireRate) {
      this.timeSinceShot = 0;
      GameState.state.flashes.push(new ShotFlash(this.x, this.y, target.x, target.y, this.color));
      GameState.state.projectiles.push(
        new Projectile(this.x, this.y, target, this.stats.damage, this.stats.projectileSpeed, this.color)
      );
    }
  }

  findTarget() {
    let candidate = null;
    let furthestPath = -1;
    for (const enemy of GameState.state.enemies) {
      if (!enemy.isAlive) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist > this.stats.range) continue;
      const enemyProgress = enemy.pathIndex + enemy.progress / 1000;
      if (enemyProgress > furthestPath) {
        furthestPath = enemyProgress;
        candidate = enemy;
      }
    }
    return candidate;
  }

  getUpgradeData() {
    return towerCatalog[this.type].upgrades[this.level] || null;
  }

  upgrade() {
    // Tower upgrades replace the active combat/economy stats with the next tier.
    const next = this.getUpgradeData();
    if (!next) return { ok: false, reason: "Max level reached." };
    if (!GameState.spendGold(next.cost)) return { ok: false, reason: "Not enough gold." };
    this.level += 1;
    this.stats.damage = next.damage;
    this.stats.range = next.range;
    this.stats.fireRate = next.fireRate;
    this.stats.farmBonus = next.farmBonus || 0;
    return { ok: true, reason: `Upgraded ${this.name} to level ${this.level + 1}.` };
  }

  getSellValue() {
    const spent = this.cost + towerCatalog[this.type].upgrades.slice(0, this.level).reduce((sum, upg) => sum + upg.cost, 0);
    return Math.round(spent * 0.7);
  }

  getFarmBonus() {
    return this.stats.farmBonus || 0;
  }

  draw(ctx, selected = false) {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = selected ? 4 : 2;
    ctx.strokeStyle = selected ? "#ffcf5d" : "rgba(10,20,34,0.8)";
    ctx.stroke();

    if (this.type === "sniper") {
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + 16, this.y - 16);
      ctx.stroke();
    } else if (this.type === "farm") {
      ctx.fillStyle = "rgba(80,50,8,0.35)";
      ctx.fillRect(this.x - 11, this.y - 11, 22, 22);
    }

    if (selected && this.type !== "farm") {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#d6f2ff";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

const WaveManager = {
  queue: [],
  spawnTimer: 0,
  spawnInterval: 1.15,
  reset() {
    this.queue = [];
    this.spawnTimer = 0;
  },
  startWave() {
    if (GameState.state.waveInProgress || GameState.state.isGameOver) return false;
    GameState.state.wave += 1;
    GameState.state.waveInProgress = true;
    const wave = GameState.state.wave;
    this.queue = this.buildWave(wave);
    this.spawnTimer = 0;
    UIManager.setStatus(`Wave ${wave} started`);
    return true;
  },
  buildWave(wave) {
    const enemyTypes = [
      { type: "basic", health: 28 + wave * 9, speed: 64 + wave * 1.6, reward: 12 + wave * 2, color: "#59a6ff", radius: 16 },
      { type: "fast", health: 18 + wave * 6, speed: 96 + wave * 2.4, reward: 14 + wave * 2.2, color: "#ffd84a", radius: 13 },
      { type: "tank", health: 65 + wave * 18, speed: 40 + wave * 1.1, reward: 24 + wave * 3.5, color: "#ff6b6b", radius: 19 }
    ];
    const total = 6 + wave * 2;
    const entries = [];
    for (let i = 0; i < total; i += 1) {
      let template = enemyTypes[0];
      if (wave >= 2 && i % 3 === 1) template = enemyTypes[1];
      if (wave >= 3 && i % 4 === 3) template = enemyTypes[2];
      if (wave >= 6 && i % 5 === 4) template = enemyTypes[2];
      entries.push({ ...template });
    }
    return entries;
  },
  update(deltaTime) {
    if (!GameState.state.waveInProgress) return;
    this.spawnTimer -= deltaTime;
    if (this.queue.length > 0 && this.spawnTimer <= 0) {
      GameState.state.enemies.push(new Enemy(this.queue.shift()));
      this.spawnTimer = Math.max(0.42, this.spawnInterval - GameState.state.wave * 0.03);
    }
    if (this.queue.length === 0 && GameState.state.enemies.length === 0) {
      GameState.state.waveInProgress = false;
      UIManager.setStatus("Wave cleared");
    }
  }
};

const QuestionManager = {
  activeQuestion: null,
  timeRemaining: 0,
  intervalId: null,
  pendingCallback: null,
  reset() {
    this.activeQuestion = null;
    this.timeRemaining = 0;
    this.pendingCallback = null;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof UIManager !== "undefined" && UIManager.hideQuestionModal) UIManager.hideQuestionModal();
  },
  ask(context, callback) {
    // Question system: modal gates rewards, towers, and abilities. It only freezes gameplay in singleplayer.
    if (GameState.state.isGameOver || GameState.state.isQuestionOpen) return false;
    if (questions.length === 0) {
      UIManager.setStatus("Create custom questions in the editor first");
      return false;
    }
    GameState.state.isQuestionOpen = true;
    GameState.state.questionGate = normalizeQuestionContext(context);
    this.pendingCallback = callback;
    this.activeQuestion = questions[Math.floor(Math.random() * questions.length)];
    this.timeRemaining = 10;
    UIManager.showQuestionModal(this.activeQuestion, this.timeRemaining);
    this.startTimer();
    return true;
  },
  startTimer() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (GameState.state.isPaused || !GameState.state.isQuestionOpen) return;
      this.timeRemaining = Math.max(0, this.timeRemaining - 0.1);
      UIManager.updateQuestionTimer(this.timeRemaining);
      if (this.timeRemaining <= 0) this.resolve(false, "Time ran out.");
    }, 100);
  },
  answer(selected) {
    if (!this.activeQuestion) return;
    const correct = selected === this.activeQuestion.answer;
    this.resolve(correct, correct ? "Correct answer!" : "Incorrect answer.");
  },
  resolve(correct, label) {
    if (!GameState.state.isQuestionOpen) return;
    const question = this.activeQuestion;
    const questionContext = normalizeQuestionContext(GameState.state.questionGate);
    const multiplier = GameState.getFarmMultiplier();
    let reward = 0;
    let penalty = 0;

    if (correct) {
      if (!questionContext.suppressReward) {
      reward = Math.round(question.reward * multiplier);
      GameState.addGold(reward);
      GameState.state.particles.push(new FloatingText(`+${reward}g`, 40, 40, "#ffcf5d"));
      }
    } else {
      penalty = 6;
      GameState.state.gold = Math.max(0, GameState.state.gold - penalty);
      GameState.state.particles.push(new FloatingText(`-${penalty}g`, 40, 40, "#ff8a8a"));
    }

    UIManager.setQuestionFeedback(correct ? (reward > 0 ? `${label} +${reward} gold.` : label) : `${label} -${penalty} gold.`);

    setTimeout(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      GameState.state.isQuestionOpen = false;
      const cb = this.pendingCallback;
      const payload = { correct, reward, penalty, context: questionContext };
      this.activeQuestion = null;
      this.pendingCallback = null;
      GameState.state.questionGate = null;
      UIManager.hideQuestionModal();
      if (cb) cb(payload);
      UIManager.updateAll();
    }, 550);
  }
};

const UIManager = {
  elements: {},
  init() {
    this.elements = {
      hpValue: document.getElementById("hpValue"),
      goldValue: document.getElementById("goldValue"),
      waveValue: document.getElementById("waveValue"),
      multiplierValue: document.getElementById("multiplierValue"),
      statusValue: document.getElementById("statusValue"),
      towerShop: document.getElementById("towerShop"),
      openQuestionEditorButton: document.getElementById("openQuestionEditorButton"),
      openLobbyScreenButton: document.getElementById("openLobbyScreenButton"),
      roomCodeBanner: document.getElementById("roomCodeBanner"),
      selectedTowerPanel: document.getElementById("selectedTowerPanel"),
      quickSellButton: document.getElementById("quickSellButton"),
      pauseButton: document.getElementById("pauseButton"),
      restartButton: document.getElementById("restartButton"),
      startWaveButton: document.getElementById("startWaveButton"),
      answerQuestionButton: document.getElementById("answerQuestionButton"),
      bombButton: document.getElementById("bombButton"),
      freezeButton: document.getElementById("freezeButton"),
      bombCooldownValue: document.getElementById("bombCooldownValue"),
      freezeCooldownValue: document.getElementById("freezeCooldownValue"),
      pausedOverlay: document.getElementById("pausedOverlay"),
      gameOverOverlay: document.getElementById("gameOverOverlay"),
      gameOverTitle: document.getElementById("gameOverTitle"),
      gameOverSummary: document.getElementById("gameOverSummary"),
      spectatorPanel: document.getElementById("spectatorPanel"),
      spectatorHealthList: document.getElementById("spectatorHealthList"),
      preMatchOverlay: document.getElementById("preMatchOverlay"),
      mapSelectionList: document.getElementById("mapSelectionList"),
      startMatchButton: document.getElementById("startMatchButton"),
      mapIntroText: document.getElementById("mapIntroText"),
      preMatchQuestionLink: document.getElementById("preMatchQuestionLink"),
      roomStatusValue: document.getElementById("roomStatusValue"),
      currentRoomName: document.getElementById("currentRoomName"),
      leaveRoomButton: document.getElementById("leaveRoomButton"),
      multiplayerStatus: document.getElementById("multiplayerStatus"),
      playerRoleValue: document.getElementById("playerRoleValue"),
      questionSourceValue: document.getElementById("questionSourceValue"),
      boardHealthList: document.getElementById("boardHealthList"),
      sendBasicEnemyButton: document.getElementById("sendBasicEnemyButton"),
      sendFastEnemyButton: document.getElementById("sendFastEnemyButton"),
      sendTankEnemyButton: document.getElementById("sendTankEnemyButton"),
      questionModal: document.getElementById("questionModal"),
      questionPrompt: document.getElementById("questionPrompt"),
      questionOptions: document.getElementById("questionOptions"),
      questionFeedback: document.getElementById("questionFeedback"),
      questionTimerText: document.getElementById("questionTimerText"),
      questionTimerFill: document.getElementById("questionTimerFill"),
      restartModal: document.getElementById("restartModal")
    };
    this.renderTowerShop();
    this.renderMapSelection();
    this.renderBoardHealth();
    this.updateAll();
  },
  renderMapSelection() {
    this.elements.mapSelectionList.innerHTML = "";
    MAPS.forEach((map) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `map-card${GameState.state.currentMapId === map.id ? " selected" : ""}`;
      card.innerHTML = `
        <h3>${map.name}</h3>
        <p>${map.description}</p>
        <div class="map-meta">
          <span>${map.difficulty}</span>
          <span>${map.points.length - 1} segments</span>
        </div>
      `;
      card.addEventListener("click", () => {
        GameState.state.currentMapId = map.id;
        this.renderMapSelection();
      });
      this.elements.mapSelectionList.appendChild(card);
    });
  },
  renderTowerShop() {
    this.elements.towerShop.innerHTML = "";
    Object.values(towerCatalog).forEach((tower) => {
      const card = document.createElement("div");
      card.className = "tower-card";
      card.innerHTML = `
        <div class="tower-title-row">
          <h3>${tower.name}</h3>
          <span class="tower-cost-badge">${tower.cost}g</span>
        </div>
        <div class="tower-card-layout">
          <div class="tower-visual">
            <div class="tower-icon ${tower.key}"></div>
          </div>
          <div class="tower-content">
            <div class="tower-details">
              <span>${tower.key === "farm" ? `Bonus: +${Math.round(tower.farmBonus * 100)}% gold` : `Damage: ${tower.damage}`}</span>
              <span>${tower.key === "farm" ? "Range: None" : `Range: ${tower.range}`}</span>
              <span>${tower.key === "farm" ? "Fire rate: None" : `Cooldown: ${tower.fireRate.toFixed(2)}s`}</span>
              <span>${tower.description}</span>
            </div>
          </div>
        </div>
      `;
      const button = document.createElement("button");
      button.className = "primary-button";
      button.textContent = `Buy ${tower.name}`;
      button.addEventListener("click", () => Game.requestTowerPurchase(tower.key));
      card.appendChild(button);
      this.elements.towerShop.appendChild(card);
    });
  },
  renderBoardHealth() {
    this.renderPlayerHealthList(this.elements.boardHealthList, "Join a room from the lobby to see everyone's health here.");
  },
  renderSpectatorHealth() {
    this.renderPlayerHealthList(this.elements.spectatorHealthList, "Waiting for room updates...");
  },
  renderPlayerHealthList(list, emptyText) {
    if (!list) return;
    const players = MultiplayerManager.state.players;
    list.innerHTML = "";
    if (!MultiplayerManager.state.connected || !players.length) {
      const item = document.createElement("li");
      item.className = "board-health-empty";
      item.textContent = emptyText;
      list.appendChild(item);
      return;
    }
    players.forEach((player) => {
      const item = document.createElement(GameState.isMultiplayerSpectating() ? "button" : "li");
      item.className = "board-health-item";
      if (GameState.isMultiplayerSpectating()) {
        item.type = "button";
        item.disabled = !MultiplayerManager.state.boards[player.id];
        item.classList.toggle("selected", GameState.state.spectatedPlayerId === player.id);
        item.addEventListener("click", () => Game.setSpectatedPlayer(player.id));
      }
      const role = player.id === MultiplayerManager.state.hostId ? "Host" : "Player";
      const hp = typeof player.hp === "number" ? `${player.hp} HP` : "Waiting";
      const spectateText = GameState.isMultiplayerSpectating()
        ? (MultiplayerManager.state.boards[player.id] ? "Click to spectate" : "Waiting for board")
        : role;
      item.innerHTML = `
        <div>
          <strong>${player.name}</strong>
          <span>${spectateText}${player.id === MultiplayerManager.state.playerId ? " - You" : ""}</span>
        </div>
        <strong>${hp}</strong>
      `;
      list.appendChild(item);
    });
  },
  updateAll() {
    if (!this.elements.statusValue) return;
    refreshQuestionBank();
    const { hp, gold, wave, isPaused, isGameOver, waveInProgress, abilityCooldowns, pendingPlacement } = GameState.state;
    const actionLocked = !GameState.canInteract() || Boolean(pendingPlacement);
    const onlineMatch = MultiplayerManager.state.connected;
    if (this.elements.hpValue) this.elements.hpValue.textContent = hp;
    this.elements.goldValue.textContent = gold;
    this.elements.waveValue.textContent = wave;
    this.elements.multiplierValue.textContent = `${GameState.getFarmMultiplier().toFixed(2)}x`;
    this.elements.pauseButton.textContent = isPaused ? "Resume" : "Pause";
    this.elements.pausedOverlay.classList.toggle("hidden", !isPaused || isGameOver);
    this.elements.startMatchButton.disabled = MultiplayerManager.state.connected && !MultiplayerManager.isHost();
    this.elements.startWaveButton.disabled = actionLocked || waveInProgress;
    this.elements.answerQuestionButton.disabled = actionLocked;
    this.elements.bombButton.disabled = actionLocked || abilityCooldowns.bomb > 0;
    this.elements.freezeButton.disabled = actionLocked || abilityCooldowns.freeze > 0;
    this.elements.quickSellButton.disabled = actionLocked || !GameState.state.selectedTowerId;
    const raidLocked = actionLocked || !MultiplayerManager.canSendRaid();
    this.elements.sendBasicEnemyButton.disabled = raidLocked;
    this.elements.sendFastEnemyButton.disabled = raidLocked;
    this.elements.sendTankEnemyButton.disabled = raidLocked;
    this.elements.leaveRoomButton.disabled = !MultiplayerManager.state.connected;
    this.elements.pauseButton.disabled = onlineMatch || GameState.state.isQuestionOpen || GameState.state.isGameOver;
    this.elements.restartButton.disabled = onlineMatch || GameState.state.isQuestionOpen || GameState.isMultiplayerSpectating();
    this.elements.pauseButton.classList.toggle("hidden", onlineMatch);
    this.elements.restartButton.classList.toggle("hidden", onlineMatch);
    this.elements.multiplayerStatus.textContent = MultiplayerManager.state.connected ? "Connected" : "Offline";
    this.elements.roomStatusValue.textContent = MultiplayerManager.state.connected ? "In Room" : "No Room";
    this.elements.currentRoomName.textContent = MultiplayerManager.state.roomId || "Open Lobby";
    this.elements.roomCodeBanner.textContent = MultiplayerManager.state.connected ? `Room Code: ${MultiplayerManager.state.roomId}` : "Room Code: ----";
    this.elements.roomCodeBanner.classList.toggle("hidden", !MultiplayerManager.state.connected);
    this.elements.playerRoleValue.textContent = MultiplayerManager.getRoleLabel();
    this.elements.questionSourceValue.textContent = MultiplayerManager.getQuestionSourceLabel();
    this.renderBoardHealth();
    this.renderSpectatorHealth();
    this.elements.towerShop.querySelectorAll("button").forEach((button) => {
      button.disabled = actionLocked;
    });
    this.elements.bombCooldownValue.textContent = abilityCooldowns.bomb > 0 ? `${abilityCooldowns.bomb.toFixed(1)}s` : "Ready";
    this.elements.freezeCooldownValue.textContent = abilityCooldowns.freeze > 0 ? `${abilityCooldowns.freeze.toFixed(1)}s` : "Ready";
    this.updateSelectedTower();
  },
  updateSelectedTower() {
    const tower = GameState.state.towers.find((item) => item.id === GameState.state.selectedTowerId);
    const panel = this.elements.selectedTowerPanel;
    if (!panel) return;
    if (!tower) {
      panel.className = "selected-panel empty";
      panel.innerHTML = "<p>Select a tower on the map.</p>";
      return;
    }
    const next = tower.getUpgradeData();
    panel.className = "selected-panel";
    panel.innerHTML = `
      <h3>${tower.name}</h3>
      <p>Level ${tower.level + 1} ${tower.type === "farm" ? "economic support" : "combat platform"}.</p>
      <div class="tower-stats">
        <span>Damage: ${tower.stats.damage}</span>
        <span>Range: ${tower.stats.range || "None"}</span>
        <span>${tower.type === "farm" ? `Bonus: +${Math.round(tower.getFarmBonus() * 100)}%` : `Cooldown: ${tower.stats.fireRate.toFixed(2)}s`}</span>
        <span>Sell: ${tower.getSellValue()}g</span>
      </div>
      <div class="upgrade-preview">
        ${next
          ? `<span>Next cost: ${next.cost}g</span>
             <span>${tower.type === "farm" ? `Next bonus: +${Math.round((next.farmBonus || 0) * 100)}%` : `Next damage: ${next.damage}`}</span>
             <span>${tower.type === "farm" ? "Next range: None" : `Next range: ${next.range}`}</span>
             <span>${tower.type === "farm" ? "Next fire: None" : `Next cooldown: ${next.fireRate.toFixed(2)}s`}</span>`
          : `<span>Max level reached</span><span>No further upgrades</span><span>Keep defending</span><span>Sell any time</span>`}
      </div>
      <div class="selected-actions">
        <button id="upgradeTowerButton" class="primary-button" ${next ? "" : "disabled"}>Upgrade</button>
        <button id="sellTowerButton" class="danger-button">Sell</button>
      </div>
    `;
    const upgradeButton = document.getElementById("upgradeTowerButton");
    const sellButton = document.getElementById("sellTowerButton");
    if (upgradeButton) upgradeButton.addEventListener("click", () => Game.upgradeSelectedTower());
    if (sellButton) sellButton.addEventListener("click", () => Game.sellSelectedTower());
  },
  setStatus(text) {
    if (this.elements.statusValue) this.elements.statusValue.textContent = text;
  },
  showQuestionModal(question, timeRemaining) {
    if (!this.elements.questionModal) return;
    this.elements.questionModal.classList.remove("hidden");
    this.elements.questionModal.setAttribute("aria-hidden", "false");
    this.elements.questionPrompt.textContent = question.question;
    this.elements.questionFeedback.textContent = "";
    this.elements.questionOptions.innerHTML = "";
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.className = "question-option";
      button.textContent = option;
      button.addEventListener("click", () => QuestionManager.answer(option));
      this.elements.questionOptions.appendChild(button);
    });
    this.updateQuestionTimer(timeRemaining);
    this.updateAll();
  },
  updateQuestionTimer(timeRemaining) {
    if (!this.elements.questionTimerText || !this.elements.questionTimerFill) return;
    const ratio = Math.max(0, Math.min(1, timeRemaining / 10));
    this.elements.questionTimerText.textContent = `${Math.ceil(timeRemaining)}s`;
    this.elements.questionTimerFill.style.width = `${ratio * 100}%`;
  },
  setQuestionFeedback(text) {
    if (this.elements.questionFeedback) this.elements.questionFeedback.textContent = text;
  },
  hideQuestionModal() {
    if (!this.elements.questionModal) return;
    this.elements.questionModal.classList.add("hidden");
    this.elements.questionModal.setAttribute("aria-hidden", "true");
    if (this.elements.questionFeedback) this.elements.questionFeedback.textContent = "";
  },
  showRestartModal() {
    GameState.state.isRestartModalOpen = true;
    this.elements.restartModal.classList.remove("hidden");
    this.elements.restartModal.setAttribute("aria-hidden", "false");
    this.updateAll();
  },
  hideRestartModal() {
    if (!this.elements.restartModal) return;
    GameState.state.isRestartModalOpen = false;
    this.elements.restartModal.classList.add("hidden");
    this.elements.restartModal.setAttribute("aria-hidden", "true");
    this.updateAll();
  },
  showGameOver(summary) {
    this.elements.gameOverSummary.textContent = summary;
    const spectating = GameState.isMultiplayerSpectating();
    if (this.elements.gameOverTitle) this.elements.gameOverTitle.textContent = spectating ? "Spectating Room" : "Base Lost";
    if (this.elements.spectatorPanel) this.elements.spectatorPanel.classList.toggle("hidden", !spectating);
    const restartButton = document.getElementById("gameOverRestartButton");
    if (restartButton) {
      restartButton.classList.toggle("hidden", spectating);
      restartButton.disabled = spectating;
    }
    this.renderSpectatorHealth();
    this.elements.gameOverOverlay.classList.toggle("hidden", spectating);
    this.updateAll();
  },
  hideGameOver() {
    if (this.elements.gameOverOverlay) this.elements.gameOverOverlay.classList.add("hidden");
    if (this.elements.gameOverTitle) this.elements.gameOverTitle.textContent = "Base Lost";
    if (this.elements.spectatorPanel) this.elements.spectatorPanel.classList.add("hidden");
    const restartButton = document.getElementById("gameOverRestartButton");
    if (restartButton) {
      restartButton.classList.remove("hidden");
      restartButton.disabled = false;
    }
  },
  showPreMatch() {
    if (!this.elements.preMatchOverlay) return;
    if (MultiplayerManager.state.connected) {
      const roomMap = MAPS.find((map) => map.id === MultiplayerManager.state.selectedMapId) || MAPS[0];
      this.elements.mapSelectionList.innerHTML = `<div class="empty-state">Room map: ${roomMap.name}. Select maps and start the match from the lobby.</div>`;
      this.elements.mapIntroText.textContent = MultiplayerManager.state.matchStarted
        ? "The room match is launching."
        : (MultiplayerManager.isHost()
          ? `Room map is ${roomMap.name}. Start the room match here or from the lobby.`
          : "Waiting for the host to start the room match.");
      this.elements.preMatchQuestionLink.classList.add("hidden");
      this.elements.startMatchButton.disabled = !MultiplayerManager.isHost();
      if (MultiplayerManager.state.matchStarted) {
        this.hidePreMatch();
        return;
      }
    } else {
      this.renderMapSelection();
      this.elements.mapIntroText.textContent = "Pick a battlefield before the match begins.";
      this.elements.preMatchQuestionLink.classList.toggle("hidden", questions.length > 0);
      this.elements.startMatchButton.disabled = false;
    }
    this.elements.preMatchOverlay.classList.remove("hidden");
  },
  hidePreMatch() {
    if (!this.elements.preMatchOverlay) return;
    this.elements.preMatchOverlay.classList.add("hidden");
  }
};

const MultiplayerManager = {
  state: {
    connected: false,
    roomId: "",
    playerId: "",
    side: "",
    hostId: "",
    players: [],
    hostQuestions: [],
    selectedMapId: MAPS[0].id,
    matchStarted: false,
    opponent: null,
    boards: {},
    eventSource: null,
    lastSentHp: null,
    lastSentGold: null,
    lastSentBoard: null,
    lastBoardSentAt: 0
  },
  init() {
    const session = loadMultiplayerSession();
    if (session) {
      this.joinRoom(session);
      return;
    }
    UIManager.setStatus("Open the lobby to join a room");
  },
  apiPath(path) {
    if (window.location.protocol.startsWith("http")) return path;
    return `http://localhost:3000${path}`;
  },
  isHost() {
    return this.state.connected && this.state.playerId === this.state.hostId;
  },
  getRoleLabel() {
    if (!this.state.connected) return "Solo";
    return this.isHost() ? "Host" : "Player";
  },
  canControlMatch() {
    return !this.state.connected || this.isHost();
  },
  getQuestionSourceLabel() {
    if (!this.state.connected) return questions.length ? "Local custom set" : "No questions";
    return this.isHost() ? "Your custom set" : "Host custom set";
  },
  getQuestionBank() {
    if (this.state.connected && !this.isHost()) {
      return this.state.hostQuestions || [];
    }
    return getCustomQuestions();
  },
  getOpponentHealthLabel() {
    if (!this.state.connected) return "Multiplayer only";
    if (!this.state.opponent) return "Waiting";
    return typeof this.state.opponent.hp === "number" ? `${this.state.opponent.hp} HP` : "Waiting";
  },
  canSendRaid() {
    return this.state.connected && Boolean(this.state.opponent);
  },
  async joinRoom(sessionOverride = null) {
    const session = sessionOverride || loadMultiplayerSession();
    const roomId = String(session?.roomId || "").trim().toLowerCase();
    const name = String(session?.name || "Player").trim() || "Player";
    const playerId = String(session?.playerId || "").trim();
    if (!roomId) {
      UIManager.setStatus("Open the lobby to join a room");
      return;
    }
    try {
      const response = await fetch(this.apiPath("/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, name, playerId, questions: getCustomQuestions() })
      });
      const payload = await response.json();
      if (!response.ok) {
        UIManager.setStatus(payload.error || "Could not join room");
        return;
      }
      this.state.connected = true;
      this.state.roomId = payload.roomId;
      this.state.playerId = payload.playerId;
      this.state.hostId = payload.hostId || "";
      this.state.hostQuestions = Array.isArray(payload.hostQuestions) ? payload.hostQuestions : [];
      this.state.players = Array.isArray(payload.players) ? payload.players : [];
      this.state.selectedMapId = payload.selectedMapId || MAPS[0].id;
      this.state.matchStarted = Boolean(payload.matchStarted);
      this.state.boards = Object.fromEntries((Array.isArray(payload.players) ? payload.players : []).map((player) => [player.id, player.board || null]));
      this.state.side = this.isHost() ? "host" : "player";
      this.updateOpponent();
      this.openEventStream();
      saveMultiplayerSession({ roomId: payload.roomId, name, playerId: payload.playerId });
      if (this.isHost()) {
        await this.syncHostQuestions();
      } else {
        refreshQuestionBank();
      }
      this.reportHealth(true);
      this.reportGold(true);
      this.reportBoard(true);
      if (this.state.matchStarted) {
        Game.startMatch({ skipRelay: true, remoteMapId: this.state.selectedMapId });
      }
      UIManager.setStatus(`Joined ${payload.roomId}`);
      UIManager.updateAll();
    } catch (error) {
      UIManager.setStatus("Could not reach multiplayer server");
    }
  },
  async leaveRoom() {
    if (!this.state.connected) return;
    await fetch(this.apiPath("/leave"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.state.roomId, playerId: this.state.playerId })
    }).catch(() => {});
    this.resetConnectionState();
    clearMultiplayerSession();
    refreshQuestionBank();
    UIManager.setStatus("Left multiplayer room");
    UIManager.updateAll();
  },
  resetConnectionState() {
    if (this.state.eventSource) {
      this.state.eventSource.close();
    }
    this.state = {
      connected: false,
      roomId: "",
      playerId: "",
      side: "",
      hostId: "",
      players: [],
      hostQuestions: [],
      selectedMapId: MAPS[0].id,
      matchStarted: false,
      opponent: null,
      boards: {},
      eventSource: null,
      lastSentHp: null,
      lastSentGold: null,
      lastSentBoard: null,
      lastBoardSentAt: 0
    };
  },
  openEventStream() {
    if (this.state.eventSource) this.state.eventSource.close();
    const eventsUrl = `${this.apiPath("/events")}?roomId=${encodeURIComponent(this.state.roomId)}&playerId=${encodeURIComponent(this.state.playerId)}`;
    this.state.eventSource = new EventSource(eventsUrl);
    this.state.eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleEvent(message);
    };
    this.state.eventSource.onerror = () => {
      UIManager.setStatus("Multiplayer event stream interrupted");
    };
  },
  applyRoomSnapshot(snapshot) {
    this.state.hostId = snapshot.hostId || this.state.hostId;
    this.state.players = Array.isArray(snapshot.players) ? snapshot.players : [];
    this.state.boards = Object.fromEntries(this.state.players.map((player) => [player.id, player.board || null]));
    this.state.selectedMapId = snapshot.selectedMapId || this.state.selectedMapId;
    this.state.matchStarted = Boolean(snapshot.matchStarted);
    this.state.side = this.isHost() ? "host" : "player";
    this.updateOpponent();
  },
  handleEvent(event) {
    if (event.type === "room_update") {
      const wasStarted = this.state.matchStarted;
      this.applyRoomSnapshot(event);
      if (this.isHost()) {
        this.syncHostQuestions();
      } else if (Array.isArray(event.hostQuestions)) {
        this.state.hostQuestions = event.hostQuestions;
        refreshQuestionBank();
      }
      if (!wasStarted && this.state.matchStarted) {
        Game.startMatch({ skipRelay: true, remoteMapId: this.state.selectedMapId });
      }
      UIManager.updateAll();
      return;
    }

    if (event.type === "host_questions") {
      this.state.hostId = event.payload.hostId || this.state.hostId;
      this.state.hostQuestions = Array.isArray(event.payload.questions) ? event.payload.questions : [];
      refreshQuestionBank();
      UIManager.updateAll();
      return;
    }

    if (event.type === "start_match") {
      if (event.sender !== this.state.playerId) {
        Game.startMatch({ skipRelay: true, remoteMapId: event.payload.mapId });
      }
      return;
    }

    if (event.type === "send_enemy") {
      if (event.sender !== this.state.playerId) {
        Game.spawnIncomingRaid(event.payload.kind, event.payload.senderName);
        UIManager.setStatus(`${event.payload.label} incoming from ${event.payload.senderName || "opponent"}`);
      }
      return;
    }

    if (event.type === "health_update") {
      const player = this.state.players.find((entry) => entry.id === event.sender);
      if (player) player.hp = event.payload.hp;
      this.updateOpponent();
      UIManager.updateAll();
      return;
    }

    if (event.type === "gold_update") {
      const player = this.state.players.find((entry) => entry.id === event.sender);
      if (player) player.gold = event.payload.gold;
      this.updateOpponent();
      UIManager.updateAll();
      return;
    }

    if (event.type === "board_update") {
      this.state.boards[event.sender] = event.payload || null;
      UIManager.updateAll();
    }
  },
  updateOpponent() {
    this.state.opponent = this.state.players.find((player) => player.id !== this.state.playerId) || null;
  },
  async relay(type, payload, target = null) {
    if (!this.state.connected) return;
    await fetch(this.apiPath("/relay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.state.roomId,
        playerId: this.state.playerId,
        type,
        target,
        payload
      })
    }).catch(() => {
      UIManager.setStatus("Relay failed");
    });
  },
  async syncHostQuestions() {
    if (!this.isHost()) return;
    const localQuestions = getCustomQuestions();
    this.state.hostQuestions = localQuestions;
    refreshQuestionBank();
    await this.relay("host_questions", {
      hostId: this.state.playerId,
      questions: localQuestions
    });
  },
  async broadcastMatchStart(mapId) {
    if (!this.state.connected) return;
    await this.relay("start_match", { mapId });
  },
  async sendRaid(kind) {
    const entry = multiplayerEnemyCatalog[kind];
    if (!entry || !this.state.opponent) return;
    const currentPlayer = this.state.players.find((player) => player.id === this.state.playerId);
    await this.relay("send_enemy", {
      kind,
      label: entry.label,
      senderName: currentPlayer?.name || "Player"
    }, this.state.opponent.id);
  },
  reportHealth(force = false) {
    if (!this.state.connected) return;
    if (!force && this.state.lastSentHp === GameState.state.hp) return;
    this.state.lastSentHp = GameState.state.hp;
    this.relay("health_update", { hp: GameState.state.hp });
  },
  reportGold(force = false) {
    if (!this.state.connected) return;
    if (!force && this.state.lastSentGold === GameState.state.gold) return;
    this.state.lastSentGold = GameState.state.gold;
    this.relay("gold_update", { gold: GameState.state.gold });
  },
  reportBoard(force = false) {
    if (!this.state.connected) return;
    const now = Date.now();
    if (!force && now - this.state.lastBoardSentAt < 250) return;
    const board = Game.buildBoardSnapshot();
    const serialized = JSON.stringify(board);
    if (!force && this.state.lastSentBoard === serialized) return;
    this.state.lastBoardSentAt = now;
    this.state.lastSentBoard = serialized;
    this.state.boards[this.state.playerId] = board;
    this.relay("board_update", board);
  }
};

const Game = {
  canvas: null,
  ctx: null,
  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    refreshQuestionBank();
    GameState.state = GameState.createInitialState();
    UIManager.init();
    MultiplayerManager.init();
    GameState.reset();
    this.bindEvents();
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  },
  bindEvents() {
    document.getElementById("answerQuestionButton").addEventListener("click", () => this.askFreeQuestion());
    document.getElementById("startWaveButton").addEventListener("click", () => this.requestWaveStart());
    document.getElementById("pauseButton").addEventListener("click", () => this.togglePause());
    document.getElementById("openQuestionEditorButton").addEventListener("click", (event) => {
      const opened = window.open("questions.html", "_blank", "noopener");
      if (opened) {
        event.preventDefault();
      }
    });
    document.getElementById("openLobbyScreenButton").addEventListener("click", (event) => {
      const opened = window.open("lobby.html", "_blank", "noopener");
      if (opened) {
        event.preventDefault();
      }
    });
    document.getElementById("restartButton").addEventListener("click", () => {
      if (MultiplayerManager.state.connected) {
        UIManager.setStatus("Restart is only available in singleplayer");
        return;
      }
      if (GameState.isMultiplayerSpectating()) {
        UIManager.setStatus("Defeated players spectate until the room match ends");
        return;
      }
      if (!MultiplayerManager.canControlMatch()) {
        UIManager.setStatus("Only the host can restart a room match");
        return;
      }
      if (!GameState.state.isQuestionOpen) UIManager.showRestartModal();
    });
    document.getElementById("confirmRestartButton").addEventListener("click", () => {
      if (MultiplayerManager.state.connected) {
        UIManager.hideRestartModal();
        UIManager.setStatus("Restart is only available in singleplayer");
        return;
      }
      if (GameState.isMultiplayerSpectating()) {
        UIManager.hideRestartModal();
        UIManager.setStatus("Defeated players spectate until the room match ends");
        return;
      }
      if (!MultiplayerManager.canControlMatch()) {
        UIManager.setStatus("Only the host can restart a room match");
        return;
      }
      GameState.reset();
      UIManager.setStatus("Run restarted");
    });
    document.getElementById("cancelRestartButton").addEventListener("click", () => UIManager.hideRestartModal());
    document.getElementById("gameOverRestartButton").addEventListener("click", () => {
      if (GameState.isMultiplayerSpectating()) {
        UIManager.setStatus("Defeated players spectate until the room match ends");
        return;
      }
      UIManager.showRestartModal();
    });
    document.getElementById("bombButton").addEventListener("click", () => this.requestAbility("bomb"));
    document.getElementById("freezeButton").addEventListener("click", () => this.requestAbility("freeze"));
    document.getElementById("quickSellButton").addEventListener("click", () => this.sellSelectedTower());
    document.getElementById("startMatchButton").addEventListener("click", () => this.startMatch());
    document.getElementById("leaveRoomButton").addEventListener("click", () => MultiplayerManager.leaveRoom());
    document.getElementById("sendBasicEnemyButton").addEventListener("click", () => this.requestSendEnemy("basic"));
    document.getElementById("sendFastEnemyButton").addEventListener("click", () => this.requestSendEnemy("fast"));
    document.getElementById("sendTankEnemyButton").addEventListener("click", () => this.requestSendEnemy("tank"));

    this.canvas.addEventListener("mousemove", (event) => {
      const point = this.getCanvasPoint(event);
      GameState.state.hoverPoint = { ...point, inside: true };
    });
    this.canvas.addEventListener("mouseleave", () => {
      GameState.state.hoverPoint.inside = false;
    });
    this.canvas.addEventListener("click", (event) => {
      if (!GameState.canInteract()) return;
      const point = this.getCanvasPoint(event);
      if (GameState.state.pendingPlacement) this.placePendingTower(point.x, point.y);
      else this.selectTowerAt(point.x, point.y);
    });
  },
  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  },
  askFreeQuestion() {
    QuestionManager.ask("free", ({ correct }) => UIManager.setStatus(correct ? "Knowledge rewarded" : "Study and try again"));
  },
  async startMatch(options = {}) {
    const { skipRelay = false, remoteMapId = null } = options;
    if (remoteMapId) {
      GameState.state.currentMapId = remoteMapId;
      UIManager.renderMapSelection();
    }
    if (!skipRelay && MultiplayerManager.state.connected && !MultiplayerManager.isHost()) {
      UIManager.setStatus("Only the host can start the room match");
      return;
    }
    if (MultiplayerManager.state.connected) {
      GameState.state.currentMapId = MultiplayerManager.state.selectedMapId || GameState.state.currentMapId;
      UIManager.renderMapSelection();
    }
    refreshQuestionBank();
    if (!skipRelay && MultiplayerManager.state.connected && MultiplayerManager.isHost()) {
      await MultiplayerManager.syncHostQuestions();
      refreshQuestionBank();
    }
    GameState.state.isPreMatch = false;
    UIManager.hidePreMatch();
    GameState.state.autoWaveCountdown = 2.5;
    if (!skipRelay && MultiplayerManager.state.connected) {
      await MultiplayerManager.broadcastMatchStart(GameState.state.currentMapId);
    }
    MultiplayerManager.reportHealth(true);
    MultiplayerManager.reportGold(true);
    MultiplayerManager.reportBoard(true);
    UIManager.setStatus(`${getCurrentMap().name} ready`);
    UIManager.updateAll();
  },
  requestWaveStart() {
    if (GameState.state.waveInProgress || GameState.state.isQuestionOpen || GameState.state.isGameOver || GameState.state.pendingPlacement) return;
    WaveManager.startWave();
    GameState.state.autoWaveCountdown = 0;
    UIManager.updateAll();
  },
  requestSendEnemy(kind) {
    const raid = multiplayerEnemyCatalog[kind];
    if (!raid || !MultiplayerManager.canSendRaid()) return;
    QuestionManager.ask({ id: `raid-${kind}`, suppressReward: true }, ({ correct }) => {
      if (!correct) {
        UIManager.setStatus("Raid canceled");
        return;
      }
      if (GameState.state.gold < raid.cost) {
        UIManager.setStatus("Not enough gold to send raid");
        return;
      }
      if (!GameState.spendGold(raid.cost)) {
        UIManager.setStatus("Gold changed before raid");
        return;
      }
      MultiplayerManager.sendRaid(kind);
      UIManager.setStatus(`${raid.label} sent`);
      UIManager.updateAll();
    });
  },
  requestTowerPurchase(type) {
    const towerData = towerCatalog[type];
    if (!GameState.canInteract()) return;
    if (GameState.state.pendingPlacement) return;
    if (GameState.state.gold < towerData.cost) {
      UIManager.setStatus("Not enough gold");
      return;
    }
    QuestionManager.ask({ id: `buy-${type}`, suppressReward: true }, ({ correct }) => {
      if (!correct) {
        UIManager.setStatus("Tower purchase failed");
        return;
      }
      if (!GameState.spendGold(towerData.cost)) {
        UIManager.setStatus("Gold changed before purchase");
        return;
      }
      GameState.state.pendingPlacement = type;
      UIManager.setStatus(`Place your ${towerData.name}`);
      UIManager.updateAll();
    });
  },
  placePendingTower(x, y) {
    const type = GameState.state.pendingPlacement;
    if (!type) return;
    if (!this.isValidTowerPosition(x, y)) {
      UIManager.setStatus("Invalid placement");
      return;
    }
    const tower = new Tower(type, x, y);
    GameState.state.towers.push(tower);
    GameState.state.pendingPlacement = null;
    GameState.state.selectedTowerId = tower.id;
    UIManager.setStatus(`${tower.name} deployed`);
    UIManager.updateAll();
  },
  isValidTowerPosition(x, y) {
    if (x < TOWER_PLACEMENT_RADIUS || y < TOWER_PLACEMENT_RADIUS || x > GameState.width - TOWER_PLACEMENT_RADIUS || y > GameState.height - TOWER_PLACEMENT_RADIUS) return false;
    const path = getCurrentPathPoints();
    const pathWidth = getCurrentMap().pathWidth;
    for (let i = 0; i < path.length - 1; i += 1) {
      const start = path[i];
      const end = path[i + 1];
      if (distanceToSegment(x, y, start.x, start.y, end.x, end.y) < pathWidth / 2 + TOWER_PLACEMENT_RADIUS - 8) return false;
    }
    for (const tower of GameState.state.towers) {
      if (Math.hypot(tower.x - x, tower.y - y) < tower.radius + TOWER_PLACEMENT_RADIUS + 6) return false;
    }
    return true;
  },
  selectTowerAt(x, y) {
    let selected = null;
    for (const tower of GameState.state.towers) {
      if (Math.hypot(tower.x - x, tower.y - y) <= tower.radius + 6) selected = tower;
    }
    GameState.state.selectedTowerId = selected ? selected.id : null;
    UIManager.updateSelectedTower();
  },
  setSpectatedPlayer(playerId) {
    if (!GameState.isMultiplayerSpectating()) return;
    if (!MultiplayerManager.state.boards[playerId]) {
      UIManager.setStatus("That player's board is not ready yet");
      return;
    }
    GameState.state.spectatedPlayerId = playerId;
    const player = MultiplayerManager.state.players.find((entry) => entry.id === playerId);
    UIManager.setStatus(player ? `Spectating ${player.name}` : "Spectating player");
    UIManager.updateAll();
  },
  buildBoardSnapshot() {
    return {
      mapId: GameState.state.currentMapId,
      wave: GameState.state.wave,
      towers: GameState.state.towers.map((tower) => ({
        type: tower.type,
        x: tower.x,
        y: tower.y,
        level: tower.level
      })),
      enemies: GameState.state.enemies.filter((enemy) => enemy.isAlive).map((enemy) => ({
        type: enemy.type,
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        color: enemy.color,
        senderName: enemy.senderName || ""
      }))
    };
  },
  upgradeSelectedTower() {
    if (!GameState.canInteract()) return;
    const tower = GameState.state.towers.find((item) => item.id === GameState.state.selectedTowerId);
    if (!tower) return;
    const result = tower.upgrade();
    UIManager.setStatus(result.reason);
    UIManager.updateAll();
  },
  sellSelectedTower() {
    if (!GameState.canInteract()) return;
    const index = GameState.state.towers.findIndex((item) => item.id === GameState.state.selectedTowerId);
    if (index === -1) return;
    const tower = GameState.state.towers[index];
    GameState.addGold(tower.getSellValue());
    GameState.state.towers.splice(index, 1);
    GameState.state.selectedTowerId = null;
    UIManager.setStatus(`${tower.name} sold`);
    UIManager.updateAll();
  },
  spawnIncomingRaid(kind, senderName = "") {
    const entry = multiplayerEnemyCatalog[kind];
    if (!entry) return;
    for (let i = 0; i < entry.count; i += 1) {
      GameState.state.enemies.push(new Enemy(buildRaidEnemy(kind, i, senderName)));
    }
  },
  requestAbility(type) {
    if (!GameState.canInteract() || GameState.state.abilityCooldowns[type] > 0 || GameState.state.pendingPlacement) return;
    QuestionManager.ask(`ability-${type}`, ({ correct }) => {
      if (!correct) {
        UIManager.setStatus(`${capitalize(type)} failed`);
        return;
      }
      if (type === "bomb") this.useBomb();
      else this.useFreeze();
    });
  },
  useBomb() {
    const enemies = [...GameState.state.enemies].filter((enemy) => enemy.isAlive).sort((a, b) => b.health - a.health).slice(0, 4);
    enemies.forEach((enemy) => enemy.takeDamage(70));
    GameState.state.abilityCooldowns.bomb = abilityCatalog.bomb.cooldown;
    UIManager.setStatus(enemies.length ? "Bomb strike landed" : "Bomb found no targets");
    UIManager.updateAll();
  },
  useFreeze() {
    GameState.state.freezeRemaining = abilityCatalog.freeze.duration;
    GameState.state.abilityCooldowns.freeze = abilityCatalog.freeze.cooldown;
    UIManager.setStatus("Freeze activated");
    UIManager.updateAll();
  },
  togglePause() {
    if (MultiplayerManager.state.connected) {
      UIManager.setStatus("Pause is only available in singleplayer");
      return;
    }
    if (GameState.state.isGameOver || GameState.state.isQuestionOpen) return;
    GameState.state.isPaused = !GameState.state.isPaused;
    UIManager.setStatus(GameState.state.isPaused ? "Paused" : "Battle resumed");
    UIManager.updateAll();
  },
  update(deltaTime) {
    if (
      GameState.state.isPaused ||
      (GameState.state.isQuestionOpen && GameState.questionPausesGameplay()) ||
      GameState.state.isGameOver ||
      GameState.state.isRestartModalOpen ||
      GameState.state.isPreMatch
    ) return;
    if (GameState.state.freezeRemaining > 0) GameState.state.freezeRemaining = Math.max(0, GameState.state.freezeRemaining - deltaTime);
    Object.keys(GameState.state.abilityCooldowns).forEach((key) => {
      GameState.state.abilityCooldowns[key] = Math.max(0, GameState.state.abilityCooldowns[key] - deltaTime);
    });

    WaveManager.update(deltaTime);
    GameState.state.enemies.forEach((enemy) => enemy.update(deltaTime));
    GameState.state.towers.forEach((tower) => tower.update(deltaTime));
    GameState.state.projectiles.forEach((projectile) => projectile.update(deltaTime));
    GameState.state.particles.forEach((particle) => particle.update(deltaTime));
    GameState.state.flashes.forEach((flash) => flash.update(deltaTime));

    GameState.state.enemies = GameState.state.enemies.filter((enemy) => enemy.isAlive);
    GameState.state.projectiles = GameState.state.projectiles.filter((projectile) => projectile.active);
    GameState.state.particles = GameState.state.particles.filter((particle) => particle.life > 0);
    GameState.state.flashes = GameState.state.flashes.filter((flash) => flash.life > 0);
    if (!GameState.state.waveInProgress && GameState.state.enemies.length === 0) {
      if (GameState.state.autoWaveCountdown <= 0) {
        GameState.state.autoWaveCountdown = 2.5;
      } else {
        GameState.state.autoWaveCountdown = Math.max(0, GameState.state.autoWaveCountdown - deltaTime);
        if (GameState.state.autoWaveCountdown <= 0.001) {
          WaveManager.startWave();
        }
      }
    } else {
      GameState.state.autoWaveCountdown = 0;
    }
    MultiplayerManager.reportHealth();
    MultiplayerManager.reportGold();
    MultiplayerManager.reportBoard();
    UIManager.updateAll();
  },
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const spectatedBoard = GameState.isMultiplayerSpectating()
      ? MultiplayerManager.state.boards[GameState.state.spectatedPlayerId] || null
      : null;

    if (spectatedBoard) {
      drawRemoteBoard(ctx, spectatedBoard);
    } else {
      drawPath(ctx);
      GameState.state.towers.forEach((tower) => tower.draw(ctx, tower.id === GameState.state.selectedTowerId));
      GameState.state.flashes.forEach((flash) => flash.draw(ctx));
      GameState.state.projectiles.forEach((projectile) => projectile.draw(ctx));
      GameState.state.enemies.forEach((enemy) => enemy.draw(ctx));
      GameState.state.particles.forEach((particle) => particle.draw(ctx));
    }

    if (GameState.state.pendingPlacement && GameState.state.hoverPoint.inside) {
      const { x, y } = GameState.state.hoverPoint;
      const valid = this.isValidTowerPosition(x, y);
      const towerData = towerCatalog[GameState.state.pendingPlacement];
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.fillStyle = valid ? towerData.color : "#ff6b6b";
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      if (towerData.range > 0) {
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(x, y, towerData.range, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (GameState.state.freezeRemaining > 0 && !GameState.state.isPaused) {
      ctx.save();
      ctx.fillStyle = "rgba(170, 225, 255, 0.08)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    if (GameState.isMultiplayerSpectating()) {
      drawSpectatorOverlay(ctx);
    }
  },
  loop(timestamp) {
    if (!GameState.state.lastTime) GameState.state.lastTime = timestamp;
    const deltaTime = Math.min(0.033, (timestamp - GameState.state.lastTime) / 1000);
    GameState.state.lastTime = timestamp;
    try {
      this.update(deltaTime);
      this.draw();
    } catch (error) {
      console.error("Game loop error:", error);
      UIManager.setStatus("A game error occurred. The loop recovered.");
    }
    requestAnimationFrame((time) => this.loop(time));
  }
};

function drawPath(ctx) {
  const map = getCurrentMap();
  drawPathForMap(ctx, map);
}

function getMapById(mapId) {
  return MAPS.find((map) => map.id === mapId) || MAPS[0];
}

function drawPathForMap(ctx, map) {
  const path = map.points;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = map.pathWidth;
  ctx.strokeStyle = map.pathOuter;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
  ctx.lineWidth = map.pathWidth - 18;
  ctx.strokeStyle = map.pathInner;
  ctx.stroke();
  const end = path[path.length - 1];
  ctx.fillStyle = map.baseColor;
  ctx.fillRect(end.x - 38, end.y - 38, 62, 62);
  ctx.fillStyle = "#eef4ff";
  ctx.font = "bold 16px Segoe UI";
  ctx.fillText("BASE", end.x - 28, end.y - 2);
  ctx.restore();
}

function drawRemoteBoard(ctx, board) {
  const map = getMapById(board?.mapId);
  drawPathForMap(ctx, map);
  (board?.towers || []).forEach((tower) => drawTowerSnapshot(ctx, tower));
  (board?.enemies || []).forEach((enemy) => drawEnemySnapshot(ctx, enemy));
}

function drawTowerSnapshot(ctx, tower) {
  const data = towerCatalog[tower.type] || towerCatalog.basic;
  const color = data.color;
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(10,20,34,0.8)";
  ctx.stroke();
  if (tower.type === "sniper") {
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y);
    ctx.lineTo(tower.x + 16, tower.y - 16);
    ctx.stroke();
  } else if (tower.type === "farm") {
    ctx.fillStyle = "rgba(80,50,8,0.35)";
    ctx.fillRect(tower.x - 11, tower.y - 11, 22, 22);
  }
  ctx.fillStyle = "#eef4ff";
  ctx.font = "bold 11px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(`L${Number(tower.level || 0) + 1}`, tower.x, tower.y + 34);
  ctx.restore();
}

function drawEnemySnapshot(ctx, enemy) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = enemy.color || "#59a6ff";
  ctx.arc(enemy.x, enemy.y, enemy.radius || 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.stroke();
  const radius = enemy.radius || 16;
  const barWidth = radius * 2.3;
  const healthRatio = Math.max(0, Math.min(1, (enemy.health || 0) / Math.max(1, enemy.maxHealth || 1)));
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - radius - 12, barWidth, 6);
  ctx.fillStyle = "#57e389";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - radius - 12, barWidth * healthRatio, 6);
  if (enemy.senderName) {
    ctx.fillStyle = "rgba(4, 8, 15, 0.72)";
    ctx.fillRect(enemy.x - 46, enemy.y - radius - 28, 92, 12);
    ctx.fillStyle = "#ffcf5d";
    ctx.font = "bold 10px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(enemy.senderName, enemy.x, enemy.y - radius - 18);
  }
  ctx.restore();
}

function drawSpectatorOverlay(ctx) {
  const players = MultiplayerManager.state.players || [];
  const panelX = 18;
  const panelY = 18;
  const panelWidth = 310;
  const rowHeight = 28;
  const headerHeight = 68;
  const panelHeight = headerHeight + Math.max(1, players.length) * rowHeight + 16;

  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 15, 0.76)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = "rgba(255, 207, 93, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  ctx.fillStyle = "#ffcf5d";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText("Spectating Room", panelX + 16, panelY + 30);

  ctx.fillStyle = "#eef4ff";
  ctx.font = "13px Segoe UI";
  ctx.fillText("Your base fell. You're still watching the live match.", panelX + 16, panelY + 52);

  let y = panelY + 84;
  if (!players.length) {
    ctx.fillStyle = "#9eb0cf";
    ctx.fillText("Waiting for room updates...", panelX + 16, y);
  } else {
    players.forEach((player) => {
      const isHost = player.id === MultiplayerManager.state.hostId;
      const isSelf = player.id === MultiplayerManager.state.playerId;
      const hp = typeof player.hp === "number" ? player.hp : "--";
      const gold = typeof player.gold === "number" ? player.gold : "--";
      ctx.fillStyle = isSelf ? "#4ed6a8" : "#eef4ff";
      ctx.font = "bold 13px Segoe UI";
      ctx.fillText(`${player.name}${isSelf ? " (You)" : ""}${isHost ? " [Host]" : ""}`, panelX + 16, y);
      ctx.fillStyle = "#ffcf5d";
      ctx.textAlign = "right";
      ctx.fillText(`${hp} HP | ${gold}g`, panelX + panelWidth - 16, y);
      ctx.textAlign = "left";
      y += rowHeight;
    });
  }
  ctx.restore();
}

function buildRaidEnemy(kind, index, senderName = "") {
  const wave = Math.max(1, GameState.state.wave || 1);
  const offset = index * 16;
  if (kind === "fast") {
    return {
      type: "fast",
      health: 24 + wave * 7,
      speed: 112 + wave * 2.5 + offset,
      reward: 10 + wave,
      color: "#ffd84a",
      radius: 13,
      senderName
    };
  }
  if (kind === "tank") {
    return {
      type: "tank",
      health: 90 + wave * 22,
      speed: 42 + wave * 1.3,
      reward: 20 + wave * 2,
      color: "#ff6b6b",
      radius: 20,
      senderName
    };
  }
  return {
    type: "basic",
    health: 34 + wave * 10,
    speed: 72 + wave * 1.7 + offset,
    reward: 8 + wave,
    color: "#59a6ff",
    radius: 16,
    senderName
  };
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Future multiplayer idea:
// Players answer questions to send enemies to opponents

window.addEventListener("load", () => {
  Game.init();
});

window.addEventListener("beforeunload", () => {
  if (MultiplayerManager.state.connected) {
    navigator.sendBeacon(
      MultiplayerManager.apiPath("/leave"),
      JSON.stringify({ roomId: MultiplayerManager.state.roomId, playerId: MultiplayerManager.state.playerId })
    );
  }
});
