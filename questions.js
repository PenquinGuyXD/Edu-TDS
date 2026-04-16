const CUSTOM_QUESTIONS_KEY = "scholar-siege-custom-questions";

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
  clearAllButton: document.getElementById("clearAllButton")
};

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

function clearForm() {
  elements.form.reset();
  elements.rewardInput.value = 25;
  elements.answerSelect.value = "option1";
}

function setMessage(text, isError = false) {
  elements.formMessage.textContent = text;
  elements.formMessage.style.color = isError ? "#ff9b9b" : "#ffd483";
}

function renderSavedQuestions() {
  const questions = getCustomQuestions();
  elements.savedCount.textContent = `${questions.length} custom question${questions.length === 1 ? "" : "s"} saved.`;
  elements.savedQuestionsList.innerHTML = "";

  if (questions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No custom questions yet. Save one and it will appear here.";
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
      setMessage("Question deleted.");
    });
    card.appendChild(deleteButton);
    elements.savedQuestionsList.appendChild(card);
  });
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
  clearForm();
  setMessage("Question saved. The game will use it on the next load.");
});

elements.clearFormButton.addEventListener("click", () => {
  clearForm();
  setMessage("Form cleared.");
});

elements.clearAllButton.addEventListener("click", () => {
  saveCustomQuestions([]);
  renderSavedQuestions();
  setMessage("All custom questions removed.");
});

renderSavedQuestions();
clearForm();
