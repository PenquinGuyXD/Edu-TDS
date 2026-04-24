(function () {
  "use strict";

  const QUESTIONS_KEY = "scholar-siege-custom-questions";
  const ROOM_SESSION_KEY = "scholar-siege-room-session";
  const BESTS_KEY = "pulseRecall.rebuilt.bests";
  const RECENT_KEY = "pulseRecall.rebuilt.recent";

  const LIMITS = {
    answerSeconds: 10,
    memorizeSeconds: { 4: 10, 6: 15, 8: 20 },
    intensityRounds: { standard: 2, rematch: 4, endurance: 6 }
  };

  const state = {
    questions: [],
    bests: {
      highScore: 0,
      bestAccuracy: 0,
      bestStreak: 0,
      fastestRecallSeconds: 0,
      sessionsPlayed: 0,
      lastBestLabel: "No personal best yet"
    },
    recentSettings: {
      pairCount: 6,
      intensity: "standard"
    },
    ui: {
      screen: "screen-main-menu"
    },
    game: null
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    enforceOfflineMode();
    cacheElements();
    bindEvents();
    loadData();
    renderAll();
    showScreen("screen-main-menu");
  }

  function enforceOfflineMode() {
    try {
      sessionStorage.removeItem(ROOM_SESSION_KEY);
    } catch (error) {
      // Ignore storage failures and continue offline.
    }
  }

  function cacheElements() {
    [
      "topbar-question-count", "topbar-best-score", "topbar-best-accuracy", "library-search", "library-total-count",
      "question-library-list", "lobby-form", "lobby-pair-count", "lobby-intensity", "lobby-error",
      "preview-bank-name", "preview-pair-count", "preview-intensity", "preview-total-prompts", "preview-board-size",
      "preview-memorize-time", "preview-round-clarity", "preview-profile", "memorize-grid", "memorize-countdown",
      "start-early-btn", "cancel-match-btn", "answer-board", "prompt-card", "feedback-strip", "match-score",
      "match-round-label", "match-question-label", "match-streak", "question-timer", "question-timer-fill",
      "pulse-fill", "pulse-percent", "pulse-message", "round-direction-label", "result-score", "result-accuracy",
      "result-recall-time", "result-correct", "result-misses", "result-streak", "result-personal-best",
      "result-pulse-summary", "result-session-profile", "result-best-label", "play-again-btn"
    ].forEach((id) => {
      el[toCamel(id)] = document.getElementById(id);
    });

    el.screens = Array.from(document.querySelectorAll(".screen"));
    el.navButtons = Array.from(document.querySelectorAll("[data-nav]"));
  }

  function bindEvents() {
    el.navButtons.forEach((button) => {
      button.addEventListener("click", () => showScreen(button.dataset.nav));
    });
    el.librarySearch.addEventListener("input", renderQuestionLibrary);
    el.lobbyForm.addEventListener("submit", onBeginMatch);
    el.lobbyPairCount.addEventListener("change", updateLobbyPreview);
    el.lobbyIntensity.addEventListener("change", updateLobbyPreview);
    el.startEarlyBtn.addEventListener("click", () => startMatchLoop(true));
    el.cancelMatchBtn.addEventListener("click", cancelCurrentMatch);
    el.playAgainBtn.addEventListener("click", () => showScreen("screen-lobby"));
  }

  function loadData() {
    state.questions = loadQuestions();
    state.bests = readStorage(BESTS_KEY, state.bests);
    state.recentSettings = readStorage(RECENT_KEY, state.recentSettings);
  }

  function loadQuestions() {
    try {
      const raw = localStorage.getItem(QUESTIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((entry, index) => normalizeQuestion(entry, index))
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function normalizeQuestion(entry, index) {
    if (!entry || typeof entry.question !== "string") return null;
    const question = String(entry.question || "").trim();
    const answer = String(entry.answer || "").trim();
    const options = Array.isArray(entry.options)
      ? entry.options.map((option) => String(option || "").trim()).filter(Boolean)
      : [];

    if (!question || !answer) return null;
    if (options.length && !options.includes(answer)) return null;

    return {
      id: `pulse-${index}-${question.slice(0, 18).replace(/\s+/g, "-").toLowerCase()}`,
      left: question,
      right: answer,
      tag: String(entry.category || entry.tag || "Custom Question").trim() || "Custom Question",
      reward: Number(entry.reward) || 0,
      options
    };
  }

  function renderAll() {
    updateTopbarStats();
    renderQuestionLibrary();
    syncRecentSettings();
    updateLobbyPreview();
  }

  function updateTopbarStats() {
    el.topbarQuestionCount.textContent = String(state.questions.length);
    el.topbarBestScore.textContent = String(state.bests.highScore || 0);
    el.topbarBestAccuracy.textContent = `${Math.round(state.bests.bestAccuracy || 0)}%`;
  }

  function showScreen(screenId) {
    state.ui.screen = screenId;
    el.screens.forEach((screen) => screen.classList.toggle("active", screen.id === screenId));

    if (screenId === "screen-question-library") {
      renderQuestionLibrary();
    } else if (screenId === "screen-lobby") {
      updateLobbyPreview();
    }
  }

  function renderQuestionLibrary() {
    const query = el.librarySearch.value.trim().toLowerCase();
    const filtered = state.questions.filter((question) => {
      if (!query) return true;
      return [question.left, question.right, question.tag].some((value) =>
        String(value).toLowerCase().includes(query)
      );
    });

    el.libraryTotalCount.textContent = String(state.questions.length);

    if (!filtered.length) {
      el.questionLibraryList.innerHTML = `
        <div class="panel glass empty-library">
          <p>${state.questions.length ? "No saved questions match this search." : "No custom questions found yet. Create some first, then come back for a real Pulse Recall run."}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="questions.html">Open Question Editor</a>
          </div>
        </div>
      `;
      return;
    }

    el.questionLibraryList.innerHTML = filtered.map((question) => `
      <article class="question-item">
        <div class="question-side">
          <span>Question</span>
          <strong>${escapeHtml(question.left)}</strong>
        </div>
        <div class="question-side">
          <span>Answer</span>
          <strong>${escapeHtml(question.right)}</strong>
          <div>${escapeHtml(question.tag)}</div>
        </div>
      </article>
    `).join("");
  }

  function syncRecentSettings() {
    state.recentSettings.pairCount = Number(state.recentSettings.pairCount) || 6;
    state.recentSettings.intensity = LIMITS.intensityRounds[state.recentSettings.intensity]
      ? state.recentSettings.intensity
      : "standard";
    el.lobbyPairCount.value = String(state.recentSettings.pairCount);
    el.lobbyIntensity.value = state.recentSettings.intensity;
  }

  function updateLobbyPreview() {
    const pairCount = Number(el.lobbyPairCount.value || state.recentSettings.pairCount || 6);
    const intensity = el.lobbyIntensity.value || state.recentSettings.intensity || "standard";
    const summary = getSessionSummary(pairCount, intensity);

    el.previewBankName.textContent = `${state.questions.length} saved questions`;
    el.previewPairCount.textContent = `${pairCount} pairs`;
    el.previewIntensity.textContent = intensityLabel(intensity);
    el.previewTotalPrompts.textContent = `${summary.totalPrompts} prompts`;
    el.previewBoardSize.textContent = `${summary.boardSize} options`;
    el.previewMemorizeTime.textContent = `${summary.memorizeSeconds}s`;
    el.previewRoundClarity.textContent = `${summary.totalRounds} rounds total. One round is one full pass through ${pairCount} playable pairs in one direction.`;
    el.previewProfile.textContent = sessionProfileLabel(pairCount, intensity);

    if (state.questions.length < summary.requiredQuestionCount) {
      setInlineError(
        el.lobbyError,
        `You need at least ${summary.requiredQuestionCount} custom questions for a ${pairCount}-pair run because the board keeps 2 fixed distractors.`
      );
      return;
    }

    clearInlineError(el.lobbyError);
  }

  function onBeginMatch(event) {
    event.preventDefault();
    const pairCount = Number(el.lobbyPairCount.value);
    const intensity = el.lobbyIntensity.value;
    const summary = getSessionSummary(pairCount, intensity);

    if (state.questions.length < summary.requiredQuestionCount) {
      setInlineError(
        el.lobbyError,
        `You only have ${state.questions.length} saved questions. ${pairCount}-pair runs require ${summary.requiredQuestionCount}.`
      );
      return;
    }

    clearInlineError(el.lobbyError);
    state.recentSettings = { pairCount, intensity };
    persistRecent();
    startMemorizePhase(pairCount, intensity);
  }

  function startMemorizePhase(pairCount, intensity) {
    cleanupGameTimers();

    const playablePairs = sample(state.questions, pairCount);
    const distractorPool = state.questions.filter((question) => !playablePairs.some((pair) => pair.id === question.id));
    const distractors = sample(distractorPool, 2);
    const rounds = buildRoundPlan(playablePairs, intensity);

    state.game = {
      pairCount,
      intensity,
      rounds,
      currentRoundIndex: 0,
      currentQuestionIndex: 0,
      playablePairs,
      distractors,
      boardPairs: shuffle(playablePairs.concat(distractors)),
      score: 0,
      streak: 0,
      bestStreak: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      totalQuestions: rounds.length * playablePairs.length,
      totalRecallMs: 0,
      pulse: 52,
      pulseMessage: "Calm focus. The room is settling in.",
      memorizeStartedAt: performance.now(),
      memorizeDurationMs: LIMITS.memorizeSeconds[pairCount] * 1000,
      memorizeInterval: null,
      questionInterval: null,
      currentQuestion: null,
      answeringLocked: false
    };

    renderMemorizeGrid();
    updatePulse(state.game.pulseMessage, state.game.pulse);
    showScreen("screen-memorize");
    beginMemorizeCountdown();
  }

  function buildRoundPlan(playablePairs, intensity) {
    const totalRounds = LIMITS.intensityRounds[intensity];
    const rounds = [];

    for (let index = 0; index < totalRounds; index += 1) {
      rounds.push({
        roundNumber: index + 1,
        boardSide: index % 2 === 0 ? "left" : "right",
        promptSide: index % 2 === 0 ? "right" : "left",
        promptOrder: shuffle(playablePairs.slice())
      });
    }

    return rounds;
  }

  function renderMemorizeGrid() {
    const game = state.game;
    el.memorizeGrid.innerHTML = game.playablePairs.map((pair) => `
      <article class="memorize-pair">
        <span>${escapeHtml(pair.tag)}</span>
        <strong>${escapeHtml(pair.left)}</strong>
        <div class="memorize-divider"></div>
        <strong>${escapeHtml(pair.right)}</strong>
      </article>
    `).join("");
    el.startEarlyBtn.classList.add("hidden");
  }

  function beginMemorizeCountdown() {
    const game = state.game;
    const halfway = game.memorizeDurationMs / 2;
    updateMemorizeTimer(game.memorizeDurationMs);

    game.memorizeInterval = window.setInterval(() => {
      const elapsed = performance.now() - game.memorizeStartedAt;
      const remaining = Math.max(0, game.memorizeDurationMs - elapsed);
      updateMemorizeTimer(remaining);

      if (elapsed >= halfway) {
        el.startEarlyBtn.classList.remove("hidden");
      }

      if (remaining <= 0) {
        startMatchLoop(false);
      }
    }, 100);
  }

  function updateMemorizeTimer(remainingMs) {
    el.memorizeCountdown.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
  }

  function startMatchLoop(startEarly) {
    const game = state.game;
    if (!game) return;

    if (game.memorizeInterval) {
      clearInterval(game.memorizeInterval);
      game.memorizeInterval = null;
    }

    if (startEarly) {
      game.pulse = Math.max(48, game.pulse - 4);
      updatePulse("You cut the memorize phase short. Tension rises.", game.pulse);
    }

    showScreen("screen-match");
    beginNextPrompt();
  }

  function beginNextPrompt() {
    const game = state.game;
    const round = game.rounds[game.currentRoundIndex];

    if (!round) {
      finishSession();
      return;
    }

    if (game.currentQuestionIndex >= round.promptOrder.length) {
      game.currentRoundIndex += 1;
      game.currentQuestionIndex = 0;
      beginNextPrompt();
      return;
    }

    const pair = round.promptOrder[game.currentQuestionIndex];
    game.currentQuestion = { pair, round };
    game.answeringLocked = false;
    renderPrompt();
    startAnswerTimer();
  }

  function renderPrompt() {
    const game = state.game;
    const current = game.currentQuestion;
    const promptText = current.round.promptSide === "left" ? current.pair.left : current.pair.right;
    const boardLabel = current.round.boardSide === "left" ? "question" : "answer";
    const promptLabel = current.round.promptSide === "left" ? "question" : "answer";

    const answers = game.boardPairs.map((item) => ({
      id: item.id,
      text: current.round.boardSide === "left" ? item.left : item.right,
      correct: item.id === current.pair.id
    }));

    el.matchScore.textContent = String(game.score);
    el.matchRoundLabel.textContent = `${current.round.roundNumber} / ${game.rounds.length}`;
    el.matchQuestionLabel.textContent = `${game.currentQuestionIndex + 1} / ${game.playablePairs.length}`;
    el.matchStreak.textContent = String(game.streak);
    el.roundDirectionLabel.textContent = `Prompt: ${promptLabel} | Board: ${boardLabel}`;
    el.promptCard.textContent = promptText;
    el.feedbackStrip.textContent = "Lock in the matching association.";
    el.answerBoard.innerHTML = answers.map((answer, index) => `
      <button class="answer-option" data-answer-id="${answer.id}" type="button">
        <span>Option ${index + 1}</span>
        <strong>${escapeHtml(answer.text)}</strong>
      </button>
    `).join("");

    el.answerBoard.querySelectorAll(".answer-option").forEach((button) => {
      button.addEventListener("click", () => submitAnswer(button.dataset.answerId));
    });
  }

  function startAnswerTimer() {
    const game = state.game;
    const startedAt = performance.now();

    clearInterval(game.questionInterval);
    game.questionInterval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const remainingMs = Math.max(0, LIMITS.answerSeconds * 1000 - elapsed);
      const progress = remainingMs / (LIMITS.answerSeconds * 1000);
      el.questionTimer.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
      el.questionTimerFill.style.width = `${Math.max(0, progress * 100)}%`;

      if (remainingMs <= 0) {
        clearInterval(game.questionInterval);
        game.questionInterval = null;
        submitAnswer(null, true, elapsed);
      }
    }, 60);
  }

  function submitAnswer(answerId, timedOut = false, forcedElapsed = null) {
    const game = state.game;
    if (!game || game.answeringLocked || !game.currentQuestion) return;
    game.answeringLocked = true;

    if (game.questionInterval) {
      clearInterval(game.questionInterval);
      game.questionInterval = null;
    }

    const elapsed = forcedElapsed ?? Math.max(0, LIMITS.answerSeconds * 1000 - parseFloat(el.questionTimer.textContent || "0") * 1000);
    const correctId = game.currentQuestion.pair.id;
    const correct = answerId === correctId;

    highlightAnswers(correctId, answerId);

    if (correct) {
      const points = Math.max(120, Math.round(340 + ((LIMITS.answerSeconds * 1000 - elapsed) / 16)));
      game.score += points;
      game.correctAnswers += 1;
      game.streak += 1;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      game.totalRecallMs += elapsed;
      game.pulse = Math.min(100, game.pulse + 4);
      updatePulse("Confidence spikes. The pulse steadies.", game.pulse);
      el.feedbackStrip.textContent = `Correct. +${points}`;
    } else {
      game.wrongAnswers += 1;
      game.streak = 0;
      game.pulse = Math.max(0, game.pulse - (timedOut ? 10 : 8));
      updatePulse(timedOut ? "Too slow. The pulse dips hard." : "Wrong association. Recover your rhythm.", game.pulse);
      const correctText = game.currentQuestion.round.boardSide === "left"
        ? game.currentQuestion.pair.left
        : game.currentQuestion.pair.right;
      el.feedbackStrip.textContent = timedOut
        ? `Time. Correct answer: ${correctText}`
        : `Incorrect. Correct answer: ${correctText}`;
    }

    el.matchScore.textContent = String(game.score);
    el.matchStreak.textContent = String(game.streak);

    window.setTimeout(() => {
      game.currentQuestionIndex += 1;
      beginNextPrompt();
    }, 850);
  }

  function highlightAnswers(correctId, selectedId) {
    el.answerBoard.querySelectorAll(".answer-option").forEach((button) => {
      button.disabled = true;
      if (button.dataset.answerId === correctId) {
        button.classList.add("correct");
      }
      if (selectedId && button.dataset.answerId === selectedId && selectedId !== correctId) {
        button.classList.add("incorrect");
      }
    });
  }

  function updatePulse(message, pulse) {
    if (!state.game) return;
    state.game.pulseMessage = message;
    el.pulseMessage.textContent = message;
    el.pulsePercent.textContent = `${Math.round(pulse)}%`;
    el.pulseFill.style.width = `${Math.max(0, Math.min(100, pulse))}%`;
  }

  function finishSession() {
    cleanupGameTimers();

    const game = state.game;
    const accuracy = game.totalQuestions ? Math.round((game.correctAnswers / game.totalQuestions) * 100) : 0;
    const recallSeconds = game.correctAnswers ? (game.totalRecallMs / game.correctAnswers / 1000) : 0;
    const profile = sessionProfileLabel(game.pairCount, game.intensity);
    const previousHighScore = state.bests.highScore;
    const previousBestAccuracy = state.bests.bestAccuracy;
    const previousBestStreak = state.bests.bestStreak;
    const previousFastest = state.bests.fastestRecallSeconds;
    const bestFlags = [];

    state.bests.highScore = Math.max(state.bests.highScore, game.score);
    state.bests.bestAccuracy = Math.max(state.bests.bestAccuracy, accuracy);
    state.bests.bestStreak = Math.max(state.bests.bestStreak, game.bestStreak);
    state.bests.sessionsPlayed = Number(state.bests.sessionsPlayed || 0) + 1;

    if (recallSeconds > 0 && (!state.bests.fastestRecallSeconds || recallSeconds < state.bests.fastestRecallSeconds)) {
      state.bests.fastestRecallSeconds = recallSeconds;
    }

    if (game.score > previousHighScore) bestFlags.push("score");
    if (accuracy > previousBestAccuracy) bestFlags.push("accuracy");
    if (game.bestStreak > previousBestStreak) bestFlags.push("streak");
    if (recallSeconds > 0 && (!previousFastest || recallSeconds < previousFastest)) bestFlags.push("speed");

    state.bests.lastBestLabel = bestFlags.length
      ? `New personal best in ${bestFlags.join(", ")}.`
      : `Best score remains ${state.bests.highScore}.`;

    persistBests();
    updateTopbarStats();

    el.resultScore.textContent = String(game.score);
    el.resultAccuracy.textContent = `${accuracy}%`;
    el.resultRecallTime.textContent = `${recallSeconds.toFixed(1)}s`;
    el.resultCorrect.textContent = String(game.correctAnswers);
    el.resultMisses.textContent = String(game.wrongAnswers);
    el.resultStreak.textContent = String(game.bestStreak);
    el.resultPersonalBest.textContent = String(state.bests.highScore);
    el.resultPulseSummary.textContent = pulseSummary(game.pulse);
    el.resultSessionProfile.textContent = profile;
    el.resultBestLabel.textContent = state.bests.lastBestLabel;

    showScreen("screen-results");
  }

  function pulseSummary(pulse) {
    if (pulse >= 80) return "Locked In";
    if (pulse >= 60) return "Steady";
    if (pulse >= 35) return "Shaky";
    return "Critical";
  }

  function sessionProfileLabel(pairCount, intensity) {
    const pairText = `${pairCount}-pair`;
    const intensityText = {
      standard: "balanced",
      rematch: "extended",
      endurance: "high-pressure"
    }[intensity] || "balanced";
    return `${pairText} ${intensityText} run`;
  }

  function cancelCurrentMatch() {
    cleanupGameTimers();
    state.game = null;
    showScreen("screen-lobby");
  }

  function cleanupGameTimers() {
    if (!state.game) return;
    if (state.game.memorizeInterval) clearInterval(state.game.memorizeInterval);
    if (state.game.questionInterval) clearInterval(state.game.questionInterval);
    state.game.memorizeInterval = null;
    state.game.questionInterval = null;
  }

  function getSessionSummary(pairCount, intensity) {
    const totalRounds = LIMITS.intensityRounds[intensity] || LIMITS.intensityRounds.standard;
    return {
      requiredQuestionCount: pairCount + 2,
      totalRounds,
      totalPrompts: totalRounds * pairCount,
      boardSize: pairCount + 2,
      memorizeSeconds: LIMITS.memorizeSeconds[pairCount] || 15
    };
  }

  function intensityLabel(intensity) {
    return {
      standard: "Standard Match",
      rematch: "Rematch Series",
      endurance: "Endurance Run"
    }[intensity] || "Standard Match";
  }

  function sample(items, count) {
    return shuffle(items.slice()).slice(0, count);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toCamel(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function setInlineError(node, message) {
    node.textContent = message;
    node.classList.remove("hidden");
  }

  function clearInlineError(node) {
    node.textContent = "";
    node.classList.add("hidden");
  }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function persistBests() {
    localStorage.setItem(BESTS_KEY, JSON.stringify(state.bests));
  }

  function persistRecent() {
    localStorage.setItem(RECENT_KEY, JSON.stringify(state.recentSettings));
  }
})();
