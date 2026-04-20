const CUSTOM_QUESTIONS_KEY = "scholar-siege-custom-questions";
const QUESTION_PRESETS_KEY = "scholar-siege-question-presets";
const QUESTION_PRESETS_SEEDED_KEY = "scholar-siege-question-presets-seeded";
const SHARED_PRESET_PREFIX = "SSPRESET:";

const starterPresets = [
  {
    id: "starter-math",
    name: "Quick Math Drill",
    source: "starter",
    questions: [
      { question: "What is 7 x 8?", options: ["54", "56", "64", "58"], answer: "56", reward: 25 },
      { question: "What is 45 + 18?", options: ["63", "53", "73", "61"], answer: "63", reward: 20 },
      { question: "What is 81 / 9?", options: ["7", "8", "9", "10"], answer: "9", reward: 20 }
    ]
  },
  {
    id: "starter-science",
    name: "Science Basics",
    source: "starter",
    questions: [
      { question: "What planet is known as the Red Planet?", options: ["Mars", "Venus", "Mercury", "Jupiter"], answer: "Mars", reward: 25 },
      { question: "Water freezes at what temperature in Celsius?", options: ["10", "0", "32", "-10"], answer: "0", reward: 20 },
      { question: "Plants absorb which gas?", options: ["Oxygen", "Helium", "Carbon Dioxide", "Nitrogen"], answer: "Carbon Dioxide", reward: 25 }
    ]
  },
  {
    id: "starter-history",
    name: "History Checkpoint",
    source: "starter",
    questions: [
      { question: "Who was the first President of the United States?", options: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], answer: "George Washington", reward: 25 },
      { question: "The pyramids are in which country?", options: ["Greece", "Mexico", "Egypt", "India"], answer: "Egypt", reward: 20 },
      { question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: "Pacific", reward: 20 }
    ]
  }
];

const state = {
  editingPresetId: null
};

const elements = {
  form: document.getElementById("questionForm"),
  questionText: document.getElementById("questionText"),
  option1: document.getElementById("option1"),
  option2: document.getElementById("option2"),
  option3: document.getElementById("option3"),
  option4: document.getElementById("option4"),
  answerSelect: document.getElementById("answerSelect"),
  rewardInput: document.getElementById("rewardInput"),
  formMessage: document.getElementById("formMessage"),
  savedQuestionsList: document.getElementById("savedQuestionsList"),
  savedCount: document.getElementById("savedCount"),
  clearFormButton: document.getElementById("clearFormButton"),
  clearAllButton: document.getElementById("clearAllButton"),
  presetNameInput: document.getElementById("presetNameInput"),
  savePresetButton: document.getElementById("savePresetButton"),
  cancelPresetEditButton: document.getElementById("cancelPresetEditButton"),
  presetEditorHint: document.getElementById("presetEditorHint"),
  presetList: document.getElementById("presetList"),
  presetCount: document.getElementById("presetCount"),
  sharePresetSelect: document.getElementById("sharePresetSelect"),
  exportPresetButton: document.getElementById("exportPresetButton"),
  importPresetButton: document.getElementById("importPresetButton"),
  shareCodeInput: document.getElementById("shareCodeInput"),
  shareMessage: document.getElementById("shareMessage")
};

function ensureStarterPresets() {
  if (localStorage.getItem(QUESTION_PRESETS_SEEDED_KEY)) return;
  localStorage.setItem(QUESTION_PRESETS_KEY, JSON.stringify(starterPresets));
  localStorage.setItem(QUESTION_PRESETS_SEEDED_KEY, "true");
}

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

function saveCustomQuestions(questions) {
  localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
}

function getSavedPresets() {
  try {
    const raw = localStorage.getItem(QUESTION_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function savePresets(presets) {
  localStorage.setItem(QUESTION_PRESETS_KEY, JSON.stringify(presets));
}

function sanitizeQuestion(entry) {
  const question = String(entry?.question || "").trim();
  const answer = String(entry?.answer || "").trim();
  const reward = Math.max(1, Number(entry?.reward) || 25);
  const options = Array.isArray(entry?.options)
    ? entry.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!question || options.length !== 4 || !answer || !options.includes(answer)) return null;
  return { question, options, answer, reward };
}

function sanitizePreset(entry) {
  const name = String(entry?.name || "").trim().slice(0, 50);
  const questions = Array.isArray(entry?.questions) ? entry.questions.map(sanitizeQuestion).filter(Boolean) : [];
  if (!name || questions.length === 0) return null;
  return {
    id: String(entry?.id || `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    name,
    source: String(entry?.source || "custom"),
    questions
  };
}

function clearForm() {
  elements.form.reset();
  elements.rewardInput.value = 25;
  elements.answerSelect.value = "option1";
}

function setMessage(text, isError = false) {
  elements.formMessage.textContent = text;
  elements.formMessage.style.color = isError ? "#ff9b9b" : "#ffd483";
}

function setShareMessage(text, isError = false) {
  elements.shareMessage.textContent = text;
  elements.shareMessage.style.color = isError ? "#ff9b9b" : "#9ef0c4";
}

function syncPresetEditorUI() {
  if (state.editingPresetId) {
    const preset = getSavedPresets().find((entry) => entry.id === state.editingPresetId);
    elements.savePresetButton.textContent = "Update Preset";
    elements.cancelPresetEditButton.hidden = false;
    elements.presetEditorHint.textContent = preset ? `Editing "${preset.name}" using the active question list below.` : "Editing preset.";
  } else {
    elements.savePresetButton.textContent = "Save Current Questions As Preset";
    elements.cancelPresetEditButton.hidden = true;
    elements.presetEditorHint.textContent = "Presets save the active questions shown in Saved Questions.";
  }
}

function renderSavedQuestions() {
  const questions = getCustomQuestions();
  elements.savedCount.textContent = `${questions.length} custom question${questions.length === 1 ? "" : "s"} saved.`;
  elements.savedQuestionsList.innerHTML = "";

  if (questions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No custom questions yet. The game will only use the questions you place here.";
    elements.savedQuestionsList.appendChild(empty);
    return;
  }

  questions.forEach((entry, index) => {
    const card = document.createElement("article");
    card.className = "saved-question";
    card.innerHTML = `
      <h3>${entry.question}</h3>
      <div class="saved-meta">
        <span>Reward: ${entry.reward} gold</span>
        <span>Correct: ${entry.answer}</span>
      </div>
      <ul>
        ${entry.options.map((option) => `<li>${option}</li>`).join("")}
      </ul>
    `;
    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Delete Question";
    deleteButton.addEventListener("click", () => {
      const next = getCustomQuestions().filter((_, itemIndex) => itemIndex !== index);
      saveCustomQuestions(next);
      renderSavedQuestions();
      renderSharePresetOptions();
      setMessage("Question deleted.");
    });
    card.appendChild(deleteButton);
    elements.savedQuestionsList.appendChild(card);
  });
}

function loadPresetIntoActiveQuestions(preset) {
  saveCustomQuestions(preset.questions);
  renderSavedQuestions();
  renderSharePresetOptions();
  setMessage(`Loaded "${preset.name}" into your active game question set.`);
}

function beginPresetEdit(preset) {
  state.editingPresetId = preset.id;
  elements.presetNameInput.value = preset.name;
  saveCustomQuestions(preset.questions);
  renderSavedQuestions();
  renderSharePresetOptions();
  syncPresetEditorUI();
  setShareMessage(`Preset "${preset.name}" loaded for editing. Update it when you're ready.`);
}

function cancelPresetEdit() {
  state.editingPresetId = null;
  elements.presetNameInput.value = "";
  syncPresetEditorUI();
  setShareMessage("Preset editing cancelled.");
}

function renderPresets() {
  const presets = getSavedPresets();
  elements.presetCount.textContent = `${presets.length} preset${presets.length === 1 ? "" : "s"} available.`;
  elements.presetList.innerHTML = "";

  if (presets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No presets saved yet. Save your active questions as a preset to build your own library.";
    elements.presetList.appendChild(empty);
    return;
  }

  presets.forEach((preset) => {
    const card = document.createElement("article");
    card.className = "saved-question preset-card";
    card.innerHTML = `
      <h3>${preset.name}</h3>
      <div class="saved-meta">
        <span>${preset.questions.length} questions</span>
        <span>${preset.source === "starter" ? "Starter preset" : "Custom preset"}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "preset-actions";

    const loadButton = document.createElement("button");
    loadButton.className = "primary-button";
    loadButton.textContent = "Use This Preset";
    loadButton.addEventListener("click", () => loadPresetIntoActiveQuestions(preset));

    const editButton = document.createElement("button");
    editButton.className = "secondary-button";
    editButton.textContent = "Edit Preset";
    editButton.addEventListener("click", () => beginPresetEdit(preset));

    const exportButton = document.createElement("button");
    exportButton.className = "secondary-button";
    exportButton.textContent = "Copy Share Code";
    exportButton.addEventListener("click", async () => {
      const code = encodePresetForShare(preset);
      elements.shareCodeInput.value = code;
      try {
        await navigator.clipboard.writeText(code);
        setShareMessage(`Share code for "${preset.name}" copied.`);
      } catch (error) {
        setShareMessage(`Share code for "${preset.name}" is ready below.`);
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Delete Preset";
    deleteButton.addEventListener("click", () => {
      const next = getSavedPresets().filter((entry) => entry.id !== preset.id);
      savePresets(next);
      if (state.editingPresetId === preset.id) cancelPresetEdit();
      renderPresets();
      renderSharePresetOptions();
      setShareMessage(`Preset "${preset.name}" deleted.`);
    });

    actions.appendChild(loadButton);
    actions.appendChild(editButton);
    actions.appendChild(exportButton);
    actions.appendChild(deleteButton);

    card.appendChild(actions);
    elements.presetList.appendChild(card);
  });
}

function renderSharePresetOptions() {
  const presets = [
    ...getSavedPresets(),
    ...(getCustomQuestions().length ? [{ id: "__current__", name: "Current Active Questions", source: "active", questions: getCustomQuestions() }] : [])
  ];
  elements.sharePresetSelect.innerHTML = "";
  presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    elements.sharePresetSelect.appendChild(option);
  });
}

function getPresetById(id) {
  if (id === "__current__") {
    return { id: "__current__", name: "Current Active Questions", questions: getCustomQuestions() };
  }
  return getSavedPresets().find((preset) => preset.id === id) || null;
}

function encodePresetForShare(preset) {
  const payload = { name: preset.name, questions: preset.questions };
  return `${SHARED_PRESET_PREFIX}${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`;
}

function decodeSharedPreset(rawCode) {
  const code = String(rawCode || "").trim();
  if (!code.startsWith(SHARED_PRESET_PREFIX)) return null;
  try {
    const json = decodeURIComponent(escape(atob(code.slice(SHARED_PRESET_PREFIX.length))));
    return sanitizePreset(JSON.parse(json));
  } catch (error) {
    return null;
  }
}

function saveOrUpdatePresetFromCurrentQuestions() {
  const name = elements.presetNameInput.value.trim();
  const questions = getCustomQuestions();
  if (!name) {
    setShareMessage("Preset name is required.", true);
    return;
  }
  if (!questions.length) {
    setShareMessage("Add at least one active question before saving a preset.", true);
    return;
  }

  const currentPresets = getSavedPresets();
  if (state.editingPresetId) {
    const next = currentPresets.map((preset) => {
      if (preset.id !== state.editingPresetId) return preset;
      return sanitizePreset({
        ...preset,
        name,
        questions
      });
    }).filter(Boolean);
    savePresets(next);
    renderPresets();
    renderSharePresetOptions();
    setShareMessage(`Preset "${name}" updated.`);
    cancelPresetEdit();
    return;
  }

  const sanitized = sanitizePreset({
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    source: "custom",
    questions
  });

  if (!sanitized) {
    setShareMessage("Could not save that preset.", true);
    return;
  }

  const next = currentPresets.filter((preset) => preset.name.toLowerCase() !== sanitized.name.toLowerCase());
  next.push(sanitized);
  savePresets(next);
  elements.presetNameInput.value = "";
  renderPresets();
  renderSharePresetOptions();
  setShareMessage(`Preset "${sanitized.name}" saved.`);
}

function importSharedPreset() {
  const decoded = decodeSharedPreset(elements.shareCodeInput.value);
  if (!decoded) {
    setShareMessage("That share code is not valid.", true);
    return;
  }
  const next = getSavedPresets().filter((preset) => preset.name.toLowerCase() !== decoded.name.toLowerCase());
  next.push({ ...decoded, source: "custom" });
  savePresets(next);
  renderPresets();
  renderSharePresetOptions();
  setShareMessage(`Imported preset "${decoded.name}".`);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const options = [
    elements.option1.value.trim(),
    elements.option2.value.trim(),
    elements.option3.value.trim(),
    elements.option4.value.trim()
  ];

  if (options.some((option) => !option)) {
    setMessage("All four options are required.", true);
    return;
  }

  const answerIndex = Number(elements.answerSelect.value.replace("option", "")) - 1;
  const answer = options[answerIndex];
  const reward = Math.max(1, Number(elements.rewardInput.value) || 25);
  const question = elements.questionText.value.trim();

  if (!question) {
    setMessage("Question text is required.", true);
    return;
  }

  const next = getCustomQuestions();
  next.push({ question, options, answer, reward });
  saveCustomQuestions(next);
  renderSavedQuestions();
  renderSharePresetOptions();
  clearForm();
  setMessage("Question saved. The game only uses your active saved questions.");
});

elements.clearFormButton.addEventListener("click", () => {
  clearForm();
  setMessage("Form cleared.");
});

elements.clearAllButton.addEventListener("click", () => {
  saveCustomQuestions([]);
  renderSavedQuestions();
  renderSharePresetOptions();
  setMessage("All active questions removed.");
});

elements.savePresetButton.addEventListener("click", () => saveOrUpdatePresetFromCurrentQuestions());
elements.cancelPresetEditButton.addEventListener("click", () => cancelPresetEdit());

elements.exportPresetButton.addEventListener("click", async () => {
  const preset = getPresetById(elements.sharePresetSelect.value);
  if (!preset) {
    setShareMessage("Pick a preset to export.", true);
    return;
  }
  const code = encodePresetForShare(preset);
  elements.shareCodeInput.value = code;
  try {
    await navigator.clipboard.writeText(code);
    setShareMessage(`Share code for "${preset.name}" copied.`);
  } catch (error) {
    setShareMessage(`Share code for "${preset.name}" is ready below.`);
  }
});

elements.importPresetButton.addEventListener("click", () => importSharedPreset());

ensureStarterPresets();
renderSavedQuestions();
renderPresets();
renderSharePresetOptions();
syncPresetEditorUI();
clearForm();
