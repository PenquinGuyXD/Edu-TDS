const CUSTOM_QUESTIONS_KEY = "scholar-siege-custom-questions";
const PRACTICE_TIMED_SECONDS = 15;

function loadPracticeQuestions() {
  try {
    const raw = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry) =>
        entry &&
        typeof entry.question === "string" &&
        Array.isArray(entry.options) &&
        entry.options.length >= 2 &&
        entry.options.includes(entry.answer)
      )
      : [];
  } catch (error) {
    return [];
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const PracticeTests = {
  sourceQuestions: [],
  questionPool: [],
  currentQuestion: null,
  questionCounter: 0,
  correct: 0,
  answered: 0,
  totalResponseMs: 0,
  questionStartedAt: 0,
  timedMode: false,
  timerSecondsLeft: PRACTICE_TIMED_SECONDS,
  timerInterval: null,
  analyticsCheckpointSize: 10,
  awaitingContinue: false,
  elements: {},
  init() {
    this.elements = {
      practiceStatus: document.getElementById("practiceStatus"),
      startPracticeButton: document.getElementById("startPracticeButton"),
      restartPracticeButton: document.getElementById("restartPracticeButton"),
      continuePracticeButton: document.getElementById("continuePracticeButton"),
      endPracticeButton: document.getElementById("endPracticeButton"),
      practiceSettingsButton: document.getElementById("practiceSettingsButton"),
      practiceSettingsMenu: document.getElementById("practiceSettingsMenu"),
      timedModeToggle: document.getElementById("timedModeToggle"),
      questionTimerChip: document.getElementById("questionTimerChip"),
      practiceTestCard: document.getElementById("practiceTestCard"),
      practiceResultsCard: document.getElementById("practiceResultsCard"),
      questionProgress: document.getElementById("questionProgress"),
      correctCount: document.getElementById("correctCount"),
      accuracyValue: document.getElementById("accuracyValue"),
      questionPrompt: document.getElementById("questionPrompt"),
      answerOptions: document.getElementById("answerOptions"),
      questionFeedback: document.getElementById("questionFeedback"),
      practiceAccuracyRing: document.getElementById("practiceAccuracyRing"),
      practiceAccuracyText: document.getElementById("practiceAccuracyText"),
      practiceAverageResponse: document.getElementById("practiceAverageResponse"),
      practiceCorrectAnswers: document.getElementById("practiceCorrectAnswers"),
      practiceMissedAnswers: document.getElementById("practiceMissedAnswers")
    };

    this.elements.startPracticeButton.addEventListener("click", () => this.start());
    this.elements.restartPracticeButton.addEventListener("click", () => this.start());
    this.elements.continuePracticeButton.addEventListener("click", () => this.continueAfterAnalytics());
    this.elements.endPracticeButton.addEventListener("click", () => this.showResults(false));
    this.elements.practiceSettingsButton.addEventListener("click", () => {
      this.elements.practiceSettingsMenu.classList.toggle("hidden");
    });
    this.elements.timedModeToggle.addEventListener("change", () => {
      this.timedMode = Boolean(this.elements.timedModeToggle.checked);
      this.updateTimerChip();
      if (!this.timedMode) {
        this.clearQuestionTimer();
      } else if (this.currentQuestion && !this.awaitingContinue) {
        this.startQuestionTimer();
      }
    });
    this.refreshQuestionAvailability();
  },
  refreshQuestionAvailability() {
    const count = loadPracticeQuestions().length;
    this.elements.startPracticeButton.disabled = count === 0;
    this.elements.practiceStatus.textContent = count
      ? `Your current bank has ${count} question${count === 1 ? "" : "s"} ready for practice.`
      : "Create at least one custom question before starting a practice test.";
  },
  start() {
    const loaded = loadPracticeQuestions();
    if (!loaded.length) {
      this.refreshQuestionAvailability();
      return;
    }
    this.sourceQuestions = loaded.map((question, index) => ({
      ...question,
      _id: `${index}-${question.question}`,
      weight: 1
    }));
    this.questionPool = [...this.sourceQuestions];
    this.currentQuestion = null;
    this.questionCounter = 0;
    this.correct = 0;
    this.answered = 0;
    this.totalResponseMs = 0;
    this.awaitingContinue = false;
    this.clearQuestionTimer();
    this.elements.practiceSettingsMenu.classList.add("hidden");
    this.elements.timedModeToggle.checked = this.timedMode;
    this.elements.practiceTestCard.classList.remove("hidden");
    this.elements.practiceResultsCard.classList.add("hidden");
    this.elements.continuePracticeButton.classList.add("hidden");
    this.updateTimerChip();
    this.renderQuestion();
  },
  buildWeightedPool() {
    const pool = [];
    this.sourceQuestions.forEach((question) => {
      const count = Math.max(1, Math.round(question.weight || 1));
      for (let i = 0; i < count; i += 1) {
        pool.push(question);
      }
    });
    this.questionPool = shuffle(pool);
  },
  getNextQuestion() {
    if (!this.questionPool.length) {
      this.buildWeightedPool();
    }
    const next = this.questionPool.pop();
    return next ? { ...next, options: shuffle(next.options) } : null;
  },
  renderQuestion() {
    if (!this.sourceQuestions.length) {
      this.refreshQuestionAvailability();
      return;
    }
    this.currentQuestion = this.getNextQuestion();
    const question = this.currentQuestion;
    if (!question) return;
    this.questionCounter += 1;
    this.questionStartedAt = performance.now();
    this.elements.questionProgress.textContent = String(this.questionCounter);
    this.elements.correctCount.textContent = String(this.correct);
    this.elements.accuracyValue.textContent = `${this.answered ? Math.round((this.correct / this.answered) * 100) : 0}%`;
    this.elements.questionPrompt.textContent = question.question;
    this.elements.questionFeedback.textContent = "Choose the best answer.";
    this.elements.answerOptions.innerHTML = "";
    this.updateTimerChip();
    if (this.timedMode) {
      this.startQuestionTimer();
    }

    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.textContent = option;
      button.addEventListener("click", () => this.answer(option));
      this.elements.answerOptions.appendChild(button);
    });
  },
  updateQuestionWeight(questionId, wasCorrect) {
    const source = this.sourceQuestions.find((question) => question._id === questionId);
    if (!source) return;
    if (wasCorrect) {
      source.weight = Math.max(1, (source.weight || 1) - 1);
    } else {
      source.weight = Math.min(6, (source.weight || 1) + 2);
    }
  },
  startQuestionTimer() {
    this.clearQuestionTimer();
    this.timerSecondsLeft = PRACTICE_TIMED_SECONDS;
    this.updateTimerChip();
    this.timerInterval = window.setInterval(() => {
      this.timerSecondsLeft -= 1;
      this.updateTimerChip();
      if (this.timerSecondsLeft <= 0) {
        this.clearQuestionTimer();
        this.answer(null, true);
      }
    }, 1000);
  },
  clearQuestionTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },
  updateTimerChip() {
    this.elements.questionTimerChip.classList.toggle("hidden", !this.timedMode);
    if (this.timedMode) {
      this.elements.questionTimerChip.textContent = `${Math.max(0, this.timerSecondsLeft || PRACTICE_TIMED_SECONDS)}s`;
    }
  },
  answer(selected, timedOut = false) {
    const question = this.currentQuestion;
    if (!question) return;
    this.clearQuestionTimer();
    const responseMs = performance.now() - this.questionStartedAt;
    this.answered += 1;
    this.totalResponseMs += Math.max(0, responseMs);

    const buttons = [...this.elements.answerOptions.querySelectorAll(".option-button")];
    buttons.forEach((button) => {
      button.disabled = true;
      if (button.textContent === question.answer) button.classList.add("correct");
      if (button.textContent === selected && selected !== question.answer) button.classList.add("incorrect");
    });

    if (selected === question.answer) {
      this.correct += 1;
      this.updateQuestionWeight(question._id, true);
      this.elements.questionFeedback.textContent = "Correct.";
    } else {
      this.updateQuestionWeight(question._id, false);
      this.elements.questionFeedback.textContent = timedOut
        ? `Time expired. Correct answer: ${question.answer}`
        : `Incorrect. Correct answer: ${question.answer}`;
    }

    this.elements.correctCount.textContent = String(this.correct);
    this.elements.accuracyValue.textContent = `${Math.round((this.correct / this.answered) * 100)}%`;

    window.setTimeout(() => {
      if (this.answered % this.analyticsCheckpointSize === 0) {
        this.showResults(true);
        return;
      }
      this.renderQuestion();
    }, 700);
  },
  continueAfterAnalytics() {
    this.awaitingContinue = false;
    this.elements.practiceResultsCard.classList.add("hidden");
    this.elements.practiceTestCard.classList.remove("hidden");
    this.elements.continuePracticeButton.classList.add("hidden");
    this.renderQuestion();
  },
  showResults(canContinue) {
    const accuracy = this.answered ? Math.round((this.correct / this.answered) * 100) : 0;
    const missRate = this.answered ? 100 - accuracy : 0;
    const avgResponse = this.answered ? (this.totalResponseMs / this.answered / 1000) : 0;

    this.awaitingContinue = Boolean(canContinue);
    this.clearQuestionTimer();
    this.elements.practiceTestCard.classList.add("hidden");
    this.elements.practiceResultsCard.classList.remove("hidden");
    this.elements.continuePracticeButton.classList.toggle("hidden", !canContinue);
    this.elements.practiceAccuracyRing.style.setProperty("--ring-angle", `${accuracy * 3.6}deg`);
    this.elements.practiceAccuracyText.textContent = `${accuracy}%`;
    this.elements.practiceAverageResponse.textContent = `${avgResponse.toFixed(2)}s`;
    this.elements.practiceCorrectAnswers.textContent = `${this.correct} / ${this.answered}`;
    this.elements.practiceMissedAnswers.textContent = `${missRate}%`;
  }
};

window.addEventListener("load", () => PracticeTests.init());
