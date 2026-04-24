"use strict";

class RythemQuestion {
  constructor(prompt, options, correctAnswer) {
    this.prompt = prompt;
    this.options = options;
    this.correctAnswer = correctAnswer;
  }
}

const DEFAULT_LANE_KEYS = ["d", "f", "j", "k"];
const STARTUP_MS = 10000;
const QUESTION_BANK_STORAGE_KEY = "scholar-siege-custom-questions";
const CUSTOM_KEYBINDS_STORAGE_KEY = "rythem-mania-custom-keybinds";
const HIT_SFX_PATH = "SFX snd Kick Chroma.mp3";
const ICE_TILE_SFX_PATH = "SFX snd Ice Tile.mp3";
const NEAR_MISS_WINDOW_MS = 240;
const DIFFICULTIES = {
  easy: { label: "Easy", previewTargetMs: 4500, breakTargetMs: 3000, fillerStep: 2 },
  medium: { label: "Medium", previewTargetMs: 3000, breakTargetMs: 3000, fillerStep: 1 },
  hard: { label: "Hard", previewTargetMs: 2250, breakTargetMs: 2000, fillerStep: 1 }
};
const JUDGMENTS = [
  { label: "Perfect", windowMs: 60, score: 300, color: "#7ce2ff" },
  { label: "Great", windowMs: 110, score: 180, color: "#7bffd5" },
  { label: "Good", windowMs: 170, score: 90, color: "#ffd166" }
];

class QuestionLibrary {
  getRun(count, sourceQuestions) {
    const baseQuestions = sourceQuestions?.length ? sourceQuestions : [];
    const pool = [...baseQuestions];
    shuffle(pool);
    if (count <= pool.length) return pool.slice(0, count);
    const run = [];
    while (run.length < count) {
      const chunk = [...baseQuestions];
      shuffle(chunk);
      run.push(...chunk);
    }
    return run.slice(0, count);
  }
}

class RythemManiaGame {
  constructor() {
    this.library = new QuestionLibrary();
    this.phase = "menu";
    this.notes = [];
    this.questionRows = [];
    this.runQuestions = [];
    this.laneKeys = [...DEFAULT_LANE_KEYS];
    this.keyToLane = buildKeyToLane(this.laneKeys);
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hitCount = 0;
    this.totalJudged = 0;
    this.timingSamples = [];
    this.questionTimingSamples = [];
    this.elapsedMs = 0;
    this.chartElapsedMs = -STARTUP_MS;
    this.songStartMs = 0;
    this.lastFrameTime = 0;
    this.animationId = null;
    this.travelTimeMs = 2050;
    this.beatIntervalMs = 750;
    this.previewBeats = 4;
    this.breakBeats = 4;
    this.fillerStep = 1;
    this.difficulty = DIFFICULTIES.medium;
    this.spawnLeadMs = 2050;
    this.finishBufferMs = 2200;
    this.chartEndMs = 0;
    this.audioContext = null;
    this.beepGain = null;
    this.lastMetronomeIndex = -1;
    this.inputHitSfx = null;
    this.nearMissSfx = null;
    this.questionBank = [];
    this.elements = {
      menuScreen: document.getElementById("menu-screen"),
      gameScreen: document.getElementById("game-screen"),
      overScreen: document.getElementById("game-over-screen"),
      menuKeyNodes: [0, 1, 2, 3].map((index) => document.getElementById(`menu-key-${index}`)),
      receptorKeyNodes: [0, 1, 2, 3].map((index) => document.getElementById(`receptor-key-${index}`)),
      keybindInputs: [0, 1, 2, 3].map((index) => document.getElementById(`keybind-input-${index}`)),
      keybindStatus: document.getElementById("keybind-status"),
      difficultySelect: document.getElementById("difficulty-select"),
      bpmSelect: document.getElementById("bpm-select"),
      travelSelect: document.getElementById("travel-select"),
      questionCountSelect: document.getElementById("question-count-select"),
      questionBankStatus: document.getElementById("question-bank-status"),
      startBtn: document.getElementById("start-btn"),
      scoreDisplay: document.getElementById("score-display"),
      comboDisplay: document.getElementById("combo-display"),
      accuracyDisplay: document.getElementById("accuracy-display"),
      beatDisplay: document.getElementById("beat-display"),
      questionText: document.getElementById("question-text"),
      laneAnswerRow: document.getElementById("lane-answer-row"),
      notesLayer: document.getElementById("notes-layer"),
      judgmentText: document.getElementById("judgment-text"),
      timingText: document.getElementById("timing-text"),
      backMenuBtn: document.getElementById("back-menu-btn"),
      resultTitle: document.getElementById("result-title"),
      resultScore: document.getElementById("result-score"),
      resultStats: document.getElementById("result-stats"),
      questionSummary: document.getElementById("question-summary"),
      restartBtn: document.getElementById("restart-btn"),
      menuBtn: document.getElementById("menu-btn")
    };
    this.bindEvents();
    this.prepareSfx();
    this.loadKeybinds();
    this.loadQuestionBank();
    this.refreshKeybindUi("Click a lane key box and press a key to remap it.");
    this.refreshQuestionBankStatus();
    this.renderLaneAnswers(this.getLaneLabels("waits"));
  }

  bindEvents() {
    this.elements.startBtn.addEventListener("click", () => this.startGame());
    this.elements.restartBtn.addEventListener("click", () => this.startGame());
    this.elements.menuBtn.addEventListener("click", () => this.showMenu());
    this.elements.backMenuBtn.addEventListener("click", () => this.showMenu());
    this.elements.keybindInputs.forEach((input, index) => {
      input.addEventListener("focus", () => {
        this.elements.keybindStatus.textContent = `Press a key for Lane ${index + 1}.`;
      });
      input.addEventListener("keydown", (event) => this.handleKeybindInput(event, index));
    });
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("keyup", (event) => this.handleKeyUp(event));
    window.addEventListener("focus", () => {
      this.loadQuestionBank();
      this.refreshQuestionBankStatus();
    });
    window.addEventListener("blur", () => this.clearPressedState());
  }

  loadQuestionBank() {
    this.questionBank = this.parseSavedQuestions();
  }

  parseSavedQuestions() {
    try {
      const raw = localStorage.getItem(QUESTION_BANK_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => {
          const prompt = String(entry?.question || "").trim();
          const options = Array.isArray(entry?.options)
            ? entry.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
            : [];
          const correctAnswer = String(entry?.answer || "").trim();
          if (!prompt || options.length !== 4 || !correctAnswer || !options.includes(correctAnswer)) return null;
          return new RythemQuestion(prompt, options, correctAnswer);
        })
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  refreshQuestionBankStatus() {
    const count = this.questionBank.length;
    if (!count) {
      this.elements.questionBankStatus.textContent = "No valid saved questions found. Add at least one 4-option question in the question editor.";
      this.elements.startBtn.disabled = true;
      return;
    }
    this.elements.questionBankStatus.textContent = `Using ${count} saved question${count === 1 ? "" : "s"} from your question bank.`;
    this.elements.startBtn.disabled = false;
  }

  async startGame() {
    this.loadQuestionBank();
    this.refreshQuestionBankStatus();
    if (!this.questionBank.length) return;

    this.configureRun();
    this.phase = "game";
    this.showScreen("game");
    this.resetState();
    this.prepareAudio();
    this.warmSfx();
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn("Audio resume skipped:", error);
      }
    }
    this.songStartMs = performance.now();
    this.lastFrameTime = this.songStartMs;
    this.startLoop();
  }

  configureRun() {
    const difficultyKey = this.elements.difficultySelect.value;
    const bpm = Number(this.elements.bpmSelect.value);
    const travel = Number(this.elements.travelSelect.value);
    const requestedCount = Number(this.elements.questionCountSelect.value);
    this.difficulty = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medium;
    this.beatIntervalMs = 60000 / bpm;
    this.previewBeats = Math.max(2, Math.round(this.difficulty.previewTargetMs / this.beatIntervalMs));
    this.breakBeats = Math.max(2, Math.round(this.difficulty.breakTargetMs / this.beatIntervalMs));
    this.fillerStep = Math.max(1, this.difficulty.fillerStep);
    this.travelTimeMs = Math.round(travel * 1000);
    this.spawnLeadMs = this.travelTimeMs;
    this.finishBufferMs = this.travelTimeMs + 450;
    this.runQuestions = this.library.getRun(requestedCount, this.questionBank);
    this.buildChart();
  }

  buildChart() {
    this.notes = [];
    this.questionRows = [];
    const questionRowBeats = new Set();
    let nextPreviewBeat = 0;

    this.runQuestions.forEach((question, index) => {
      const laneOptions = shuffle([...question.options]);
      const correctLane = laneOptions.indexOf(question.correctAnswer);
      const previewStartBeat = nextPreviewBeat;
      const rowBeat = previewStartBeat + this.previewBeats;
      const rowHitTimeMs = rowBeat * this.beatIntervalMs;
      const row = {
        id: `row-${index}`,
        prompt: question.prompt,
        options: laneOptions,
        correctAnswer: question.correctAnswer,
        correctLane,
        previewStartBeat,
        previewStartMs: previewStartBeat * this.beatIntervalMs,
        rowBeat,
        rowHitTimeMs,
        resolved: false,
        result: null,
        playerAnswer: "No answer",
        timingDeltaMs: null,
        notes: []
      };

      for (let lane = 0; lane < 4; lane += 1) {
        const note = {
          id: `row-note-${index}-${lane}`,
          lane,
          hitTimeMs: rowHitTimeMs,
          judged: false,
          result: null,
          noteType: "question",
          rowId: row.id
        };
        row.notes.push(note);
        this.notes.push(note);
      }

      this.questionRows.push(row);
      questionRowBeats.add(rowBeat);
      nextPreviewBeat = rowBeat + this.breakBeats;
    });

    let previousLane = Math.floor(Math.random() * 4);
    const lastQuestionBeat = this.questionRows.length
      ? this.questionRows[this.questionRows.length - 1].rowBeat
      : 0;

    for (let beat = 0; beat < lastQuestionBeat; beat += 1) {
      if (questionRowBeats.has(beat)) continue;
      if (beat % this.fillerStep !== 0) continue;
      const lane = pickNextLane(previousLane);
      previousLane = lane;
      this.notes.push({
        id: `single-note-${beat}`,
        lane,
        hitTimeMs: beat * this.beatIntervalMs,
        judged: false,
        result: null,
        noteType: "single"
      });
    }

    this.notes.sort((a, b) => a.hitTimeMs - b.hitTimeMs || a.lane - b.lane);
    this.chartEndMs = this.questionRows.length
      ? this.questionRows[this.questionRows.length - 1].rowHitTimeMs
      : 0;
  }

  resetState() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hitCount = 0;
    this.totalJudged = 0;
    this.timingSamples = [];
    this.questionTimingSamples = [];
    this.elapsedMs = 0;
    this.chartElapsedMs = -STARTUP_MS;
    this.lastMetronomeIndex = -1;

    this.notes.forEach((note) => {
      note.judged = false;
      note.result = null;
    });
    this.questionRows.forEach((row) => {
      row.resolved = false;
      row.result = null;
      row.playerAnswer = "No answer";
      row.timingDeltaMs = null;
    });

    this.updateJudgment(
      "Ready",
      `${this.difficulty.label} mode using ${this.questionBank.length} saved questions. 10 second startup, then the chart begins on beat.`
    );
    this.updateHud();
    this.elements.notesLayer.replaceChildren();
    this.elements.questionSummary.replaceChildren();
    this.setQuestionDisplay("startup", "Get ready. The first question appears after the 10 second startup.", this.getLaneLabels("countdown"));
  }

  showMenu() {
    this.stopLoop();
    this.phase = "menu";
    this.showScreen("menu");
    this.loadQuestionBank();
    this.refreshQuestionBankStatus();
  }

  showScreen(name) {
    this.elements.menuScreen.classList.remove("active");
    this.elements.gameScreen.classList.remove("active");
    this.elements.overScreen.classList.remove("active");
    if (name === "menu") this.elements.menuScreen.classList.add("active");
    if (name === "game") this.elements.gameScreen.classList.add("active");
    if (name === "over") this.elements.overScreen.classList.add("active");
  }

  handleKeyDown(event) {
    const key = normalizeKey(event.key);
    if (!(key in this.keyToLane)) return;
    this.setLanePressed(this.keyToLane[key], true);
    if (this.phase !== "game") return;
    event.preventDefault();
    this.judgeLane(this.keyToLane[key]);
  }

  handleKeyUp(event) {
    const key = normalizeKey(event.key);
    if (!(key in this.keyToLane)) return;
    this.setLanePressed(this.keyToLane[key], false);
  }

  judgeLane(lane) {
    if (this.chartElapsedMs < 0) return;

    const missWindow = JUDGMENTS[JUDGMENTS.length - 1].windowMs;
    const activeRow = this.questionRows.find((row) =>
      !row.resolved && Math.abs(this.chartElapsedMs - row.rowHitTimeMs) <= missWindow
    );

    if (activeRow) {
      this.judgeQuestionRow(activeRow, lane);
      return;
    }

    const laneSingle = this.notes.find((note) =>
      note.noteType === "single" &&
      !note.judged &&
      note.lane === lane &&
      Math.abs(this.chartElapsedMs - note.hitTimeMs) <= missWindow
    );

    if (laneSingle) {
      this.judgeSingleNote(laneSingle);
      return;
    }

    const nearbySingle = this.notes.find((note) =>
      note.noteType === "single" &&
      !note.judged &&
      Math.abs(this.chartElapsedMs - note.hitTimeMs) <= missWindow
    );

    this.registerMiss(nearbySingle ? "Wrong lane" : "Empty lane");
  }

  judgeQuestionRow(row, lane) {
    const deltaMs = this.chartElapsedMs - row.rowHitTimeMs;
    const timing = JUDGMENTS.find((entry) => Math.abs(deltaMs) <= entry.windowMs);
    if (!timing) {
      if (Math.abs(deltaMs) <= NEAR_MISS_WINDOW_MS) {
        this.playNearMissSfx();
      }
      this.registerMiss(deltaMs < 0 ? "Too early" : "Late");
      return;
    }

    if (lane !== row.correctLane) {
      row.playerAnswer = row.options[lane] || `Lane ${lane + 1}`;
      row.timingDeltaMs = Math.round(deltaMs);
      this.markMissedRow(row, "Wrong answer");
      return;
    }

    row.resolved = true;
    row.result = timing.label;
    row.playerAnswer = row.options[lane] || `Lane ${lane + 1}`;
    row.timingDeltaMs = Math.round(deltaMs);
    row.notes.forEach((note) => {
      note.judged = true;
      note.result = timing.label;
    });
    this.score += timing.score + this.combo * 4;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.hitCount += 1;
    this.totalJudged += 1;
    this.timingSamples.push(Math.abs(deltaMs));
    this.questionTimingSamples.push(Math.abs(deltaMs));
    this.playInputSfx();
    this.updateJudgment(timing.label, `Question row ${Math.round(deltaMs)}ms`);
    this.updateHud();
    this.render();
  }

  judgeSingleNote(note) {
    const deltaMs = this.chartElapsedMs - note.hitTimeMs;
    const timing = JUDGMENTS.find((entry) => Math.abs(deltaMs) <= entry.windowMs);
    if (!timing) {
      if (Math.abs(deltaMs) <= NEAR_MISS_WINDOW_MS) {
        this.playNearMissSfx();
      }
      this.registerMiss(deltaMs < 0 ? "Too early" : "Late");
      return;
    }

    note.judged = true;
    note.result = timing.label;
    this.score += timing.score;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.hitCount += 1;
    this.totalJudged += 1;
    this.timingSamples.push(Math.abs(deltaMs));
    this.playInputSfx();
    this.updateJudgment(timing.label, `Note ${Math.round(deltaMs)}ms`);
    this.updateHud();
    this.render();
  }

  markMissedRow(row, reason) {
    row.resolved = true;
    row.result = reason;
    row.notes.forEach((note) => {
      note.judged = true;
      note.result = "Miss";
    });
    this.combo = 0;
    this.totalJudged += 1;
    this.updateJudgment("Miss", reason);
    this.updateHud();
    this.render();
  }

  registerMiss(reason) {
    this.combo = 0;
    this.totalJudged += 1;
    this.updateJudgment("Miss", reason);
    this.updateHud();
  }

  startLoop() {
    this.stopLoop();
    const frame = (time) => {
      const delta = time - this.lastFrameTime;
      this.lastFrameTime = time;
      this.elapsedMs = time - this.songStartMs;
      this.chartElapsedMs = this.elapsedMs - STARTUP_MS;
      this.render();
      this.handleAutoMisses();
      this.playMetronomeTick();

      if (this.chartElapsedMs > this.chartEndMs + this.finishBufferMs) {
        this.finishRun();
        return;
      }
      this.animationId = requestAnimationFrame(frame);
    };
    this.animationId = requestAnimationFrame(frame);
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    const layer = this.elements.notesLayer;
    const laneWidth = layer.clientWidth / 4;
    const judgmentY = this.getJudgmentLineY();
    layer.replaceChildren();

    const previewRow = this.getCurrentPreviewRow();
    if (previewRow) {
      this.setQuestionDisplay("question", previewRow.prompt, previewRow.options);
    } else if (this.chartElapsedMs < 0) {
      this.setQuestionDisplay("startup", "Get ready. The first question appears after the 10 second startup.", this.getLaneLabels("countdown"));
    } else {
      this.setQuestionDisplay("break", "Stay on beat and clear the filler notes.", this.getLaneLabels("waits"));
    }

    this.notes.forEach((note) => {
      if (note.judged) return;
      const timeUntilHit = note.hitTimeMs - this.chartElapsedMs;
      if (timeUntilHit < -220 || timeUntilHit > this.spawnLeadMs) return;
      const y = judgmentY - (timeUntilHit / this.travelTimeMs) * (judgmentY - 12);
      const node = document.createElement("div");
      node.className = `note ${note.noteType === "question" ? "question-row" : "single"} lane-${note.lane}`;
      node.style.left = `${note.lane * laneWidth}px`;
      node.style.top = `${y}px`;
      layer.appendChild(node);
    });
  }

  handleAutoMisses() {
    const missWindow = JUDGMENTS[JUDGMENTS.length - 1].windowMs;
    this.questionRows.forEach((row) => {
      if (!row.resolved && this.chartElapsedMs - row.rowHitTimeMs > missWindow) {
        row.timingDeltaMs = Math.round(this.chartElapsedMs - row.rowHitTimeMs);
        this.markMissedRow(row, "Missed question");
      }
    });

    this.notes.forEach((note) => {
      if (note.noteType === "single" && !note.judged && this.chartElapsedMs - note.hitTimeMs > missWindow) {
        note.judged = true;
        note.result = "Miss";
        this.registerMiss("Missed note");
      }
    });
  }

  finishRun() {
    this.stopLoop();
    this.phase = "over";
    this.showScreen("over");
    const accuracy = this.totalJudged ? Math.round((this.hitCount / this.totalJudged) * 100) : 100;
    const averageTiming = this.timingSamples.length
      ? `${Math.round(this.timingSamples.reduce((sum, value) => sum + value, 0) / this.timingSamples.length)}ms avg`
      : "No hits";

    this.elements.resultTitle.textContent = "Your rhythm study sprint is over.";
    this.elements.resultScore.textContent = `${this.score.toLocaleString()} pts`;
    this.elements.resultStats.textContent = `Accuracy ${accuracy}% | Max Combo ${this.maxCombo}x | ${averageTiming}`;
    this.renderQuestionSummary();
  }

  renderQuestionSummary() {
    const container = this.elements.questionSummary;
    container.replaceChildren();
    this.questionRows.forEach((row, index) => {
      const item = document.createElement("article");
      item.className = `summary-row ${row.result && row.result !== "Wrong answer" && row.result !== "Missed question" ? "good" : "bad"}`;
      const timing = typeof row.timingDeltaMs === "number" ? `${Math.abs(row.timingDeltaMs)}ms` : "No hit";
      item.innerHTML = `
        <strong>${index + 1}. ${escapeHtml(row.prompt)}</strong>
        <span>Correct: ${escapeHtml(row.correctAnswer)} | You picked: ${escapeHtml(row.playerAnswer || "No answer")} | ${escapeHtml(row.result || "Unresolved")} | ${timing}</span>
      `;
      container.appendChild(item);
    });
  }

  updateHud() {
    const accuracy = this.totalJudged ? Math.round((this.hitCount / this.totalJudged) * 100) : 100;
    this.elements.scoreDisplay.textContent = String(this.score);
    this.elements.comboDisplay.textContent = `${this.combo}x`;
    this.elements.accuracyDisplay.textContent = `${accuracy}%`;
    if (this.chartElapsedMs < 0) {
      this.elements.beatDisplay.textContent = `Startup ${Math.ceil((-this.chartElapsedMs) / 1000)}s`;
    } else {
      this.elements.beatDisplay.textContent = `${Math.max(0, Math.floor(this.chartElapsedMs / this.beatIntervalMs))}`;
    }
  }

  updateJudgment(text, timing) {
    this.elements.judgmentText.textContent = text;
    this.elements.timingText.textContent = timing;
  }

  setQuestionDisplay(mode, prompt, laneLabels) {
    this.elements.questionText.textContent = prompt;
    this.renderLaneAnswers(laneLabels);
  }

  renderLaneAnswers(labels) {
    this.elements.laneAnswerRow.innerHTML = labels.map((label, index) => `
      <div class="lane-answer lane-answer-${index}" data-lane="${index}">
        <span>Lane ${index + 1}</span>
        <strong>${escapeHtml(label)}</strong>
      </div>
    `).join("");
  }

  setLanePressed(lane, pressed) {
    const menuNode = this.elements.menuKeyNodes[lane];
    const receptorNode = this.elements.receptorKeyNodes[lane]?.parentElement;
    const answerNode = this.elements.laneAnswerRow?.querySelector(`[data-lane="${lane}"]`);
    menuNode?.classList.toggle("is-active", pressed);
    receptorNode?.classList.toggle("is-active", pressed);
    answerNode?.classList.toggle("is-active", pressed);
  }

  clearPressedState() {
    [0, 1, 2, 3].forEach((lane) => this.setLanePressed(lane, false));
  }

  getCurrentPreviewRow() {
    return this.questionRows.find((row) =>
      this.chartElapsedMs >= row.previewStartMs && this.chartElapsedMs <= row.rowHitTimeMs + JUDGMENTS[JUDGMENTS.length - 1].windowMs
    ) || null;
  }

  getLaneLabels(mode) {
    if (mode === "countdown") return this.laneKeys.map((key) => key.toUpperCase());
    return ["Stay", "On", "The", "Beat"];
  }

  getJudgmentLineY() {
    const board = document.getElementById("lane-board");
    return board.clientHeight - 122;
  }

  prepareAudio() {
    if (this.audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.audioContext = new AudioContextClass();
    this.beepGain = this.audioContext.createGain();
    this.beepGain.gain.value = 0.04;
    this.beepGain.connect(this.audioContext.destination);
  }

  prepareSfx() {
    this.inputHitSfx = new Audio(HIT_SFX_PATH);
    this.inputHitSfx.preload = "auto";
    this.inputHitSfx.volume = 0.252;

    this.nearMissSfx = new Audio(ICE_TILE_SFX_PATH);
    this.nearMissSfx.preload = "auto";
    this.nearMissSfx.volume = 0.063;
  }

  warmSfx() {
    this.inputHitSfx?.load();
    this.nearMissSfx?.load();
  }

  playInputSfx() {
    if (!this.inputHitSfx) return;
    try {
      const sound = this.inputHitSfx.cloneNode();
      sound.volume = this.inputHitSfx.volume;
      const playPromise = sound.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } catch (error) {
      // Ignore playback failures caused by rapid key presses or browser policy.
    }
  }

  playNearMissSfx() {
    if (!this.nearMissSfx) return;
    try {
      const sound = this.nearMissSfx.cloneNode();
      sound.volume = this.nearMissSfx.volume;
      const playPromise = sound.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } catch (error) {
      // Ignore playback failures caused by rapid key presses or browser policy.
    }
  }

  playMetronomeTick() {
    if (!this.audioContext || this.chartElapsedMs < 0) return;
    const beatIndex = Math.floor(this.chartElapsedMs / this.beatIntervalMs);
    if (beatIndex <= this.lastMetronomeIndex) return;
    this.lastMetronomeIndex = beatIndex;

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = beatIndex % 4 === 0 ? "square" : "triangle";
    oscillator.frequency.value = beatIndex % 4 === 0 ? 880 : 660;
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(this.beepGain);
    const now = this.audioContext.currentTime;
    gain.gain.exponentialRampToValueAtTime(1, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }

  handleKeybindInput(event, index) {
    event.preventDefault();
    const key = normalizeKey(event.key);
    if (!key || key.length !== 1) {
      this.refreshKeybindUi("Use a single letter or number key.");
      return;
    }
    if (this.laneKeys.includes(key) && this.laneKeys[index] !== key) {
      this.refreshKeybindUi("That key is already used on another lane.");
      return;
    }
    this.laneKeys[index] = key;
    this.keyToLane = buildKeyToLane(this.laneKeys);
    localStorage.setItem(CUSTOM_KEYBINDS_STORAGE_KEY, JSON.stringify(this.laneKeys));
    this.refreshKeybindUi(`Lane ${index + 1} bound to ${key.toUpperCase()}.`);
  }

  loadKeybinds() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEYBINDS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === 4) {
        this.laneKeys = parsed.map((key, index) => normalizeKey(key) || DEFAULT_LANE_KEYS[index]);
        this.keyToLane = buildKeyToLane(this.laneKeys);
      }
    } catch (error) {
      // keep defaults
    }
  }

  refreshKeybindUi(message) {
    this.elements.keybindInputs.forEach((input, index) => {
      const label = this.laneKeys[index].toUpperCase();
      input.value = label;
      this.elements.menuKeyNodes[index].textContent = label;
      this.elements.receptorKeyNodes[index].textContent = label;
    });
    this.elements.keybindStatus.textContent = message;
  }
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function buildKeyToLane(keys) {
  return keys.reduce((map, key, index) => {
    map[key] = index;
    return map;
  }, {});
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pickNextLane(previousLane) {
  let nextLane = previousLane;
  while (nextLane === previousLane) {
    nextLane = Math.floor(Math.random() * 4);
  }
  return nextLane;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.addEventListener("DOMContentLoaded", () => {
  new RythemManiaGame();
});
