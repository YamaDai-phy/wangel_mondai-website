const state = {
  questions: [],
  index: 0,
  score: 0,
  answered: false,
  wrong: [],
  bookmarks: new Set(),
  courseCount: 0,
  selectedCourse: 0,
  countdownEnabled: false,
  timerFrame: 0,
};
const $ = (id) => document.getElementById(id);
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const HISTORY_KEY = "tozan-quiz-history";
const WEAK_WORDS_KEY = "tozan-quiz-weak-words";

function fitWordOnOneLine() {
  const word = $("word");
  word.style.fontSize = "";
  let size = parseFloat(getComputedStyle(word).fontSize);
  while (word.scrollWidth > word.clientWidth && size > 6) {
    size -= 1;
    word.style.fontSize = `${size}px`;
  }
}

function showHome() {
  stopTimer();
  $("homeScreen").hidden = false;
  $("topbar").hidden = true;
  $("quizScreen").hidden = true;
  $("resultScreen").hidden = true;
  renderHistory();
  renderWeakStart();
}

function start(courseCount, source = QUESTIONS) {
  const pool = shuffle(source);
  state.questions = pool
    .slice(0, Math.min(courseCount, pool.length))
    .map((q) => {
      const choices = shuffle(q.choices);
      return { ...q, choices, answerIndex: choices.indexOf(q.answer) };
    });
  state.courseCount = state.questions.length;
  state.index = 0;
  state.score = 0;
  state.answered = false;
  state.wrong = [];
  $("total").textContent = state.courseCount;
  $("homeScreen").hidden = true;
  $("topbar").hidden = false;
  $("quizScreen").hidden = false;
  $("resultScreen").hidden = true;
  render();
}

function render() {
  const q = state.questions[state.index];
  if (!q) return finish();
  state.answered = false;
  $("current").textContent = state.index + 1;
  $("word").textContent = q.word;
  requestAnimationFrame(fitWordOnOneLine);
  $("bookmark").textContent = state.bookmarks.has(q.word) ? "★" : "☆";
  $("bookmark").classList.toggle("active", state.bookmarks.has(q.word));
  const choices = $("choices");
  choices.innerHTML = "";
  q.choices.forEach((text, i) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.innerHTML = `<span class="num">${i + 1}</span>${text}`;
    button.onclick = () => answer(i);
    choices.appendChild(button);
  });
  startTimer();
}

function stopTimer() {
  cancelAnimationFrame(state.timerFrame);
  state.timerFrame = 0;
}

function startTimer() {
  stopTimer();
  $("timerWrap").hidden = !state.countdownEnabled;
  $("timerLabel").hidden = !state.countdownEnabled;
  if (!state.countdownEnabled) return;
  const duration = 20000;
  const startedAt = performance.now();
  const tick = (now) => {
    if (state.answered) return;
    const remaining = Math.max(0, duration - (now - startedAt));
    $("progress").style.width = `${(remaining / duration) * 100}%`;
    $("timerLabel").textContent = ``;
    if (remaining === 0) answer(-1);
    else state.timerFrame = requestAnimationFrame(tick);
  };
  state.timerFrame = requestAnimationFrame(tick);
}

function answer(selected) {
  if (state.answered) return;
  state.answered = true;
  stopTimer();
  const q = state.questions[state.index];
  const buttons = [...document.querySelectorAll(".choice")];
  buttons.forEach((button, i) => {
    button.classList.add("disabled");
    button.disabled = true;
    if (i === q.answerIndex) button.classList.add("correct");
    if (i === selected && i !== q.answerIndex) button.classList.add("wrong");
  });
  if (selected === q.answerIndex) {
    state.score++;
    removeWeakWord(q.word);
  } else {
    state.wrong.push(q);
    addWeakWord(q.word);
  }
  setTimeout(
    () => {
      state.index++;
      render();
    },
    selected === q.answerIndex ? 500 : 1400,
  );
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function getWeakWords() {
  try {
    return JSON.parse(localStorage.getItem(WEAK_WORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function addWeakWord(word) {
  const words = new Set(getWeakWords());
  words.add(word);
  localStorage.setItem(WEAK_WORDS_KEY, JSON.stringify([...words]));
}

function removeWeakWord(word) {
  localStorage.setItem(
    WEAK_WORDS_KEY,
    JSON.stringify(getWeakWords().filter((item) => item !== word)),
  );
}

function renderWeakStart() {
  const weakCount = getWeakWords().length;
  $("weakStartBtn").disabled = weakCount === 0;
  $("weakStartBtn").textContent = `苦手問題を復習（${weakCount}問）`;
}

function saveResult() {
  const record = {
    score: state.score,
    total: state.questions.length,
    date: new Date().toLocaleDateString("ja-JP"),
  };
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify([record, ...getHistory()].slice(0, 8)),
  );
}

function finish() {
  $("quizScreen").hidden = true;
  $("resultScreen").hidden = false;
  $("score").textContent = `${state.score} / ${state.questions.length}`;
  const rate = state.score / state.questions.length;
  $("rank").textContent =
    rate === 1
      ? "🏆 完全制覇！"
      : rate >= 0.8
        ? "🔥 上級登山家レベル"
        : rate >= 0.6
          ? "⛰️ もう一歩！"
          : "📚 復習して再挑戦！";
  $("resultText").textContent = state.wrong.length
    ? `あとで「間違えた問題を復習」から ${state.wrong.length} 問をやり直せます。`
    : "すべて正解しました！";
  $("reviewBtn").hidden = !state.wrong.length;
  saveResult();
}

function renderHistory() {
  const records = getHistory();
  $("historyEmpty").hidden = records.length > 0;
  $("clearHistoryBtn").hidden = records.length === 0;
  $("historyList").innerHTML = records
    .map(
      (record) =>
        `<li><span>${record.date}</span><strong>${record.score} / ${record.total}</strong></li>`,
    )
    .join("");
}

document.querySelectorAll(".course").forEach(
  (button) =>
    (button.onclick = () => {
      state.selectedCourse = Number(button.dataset.count);
      document
        .querySelectorAll(".course")
        .forEach((course) =>
          course.classList.toggle("selected", course === button),
        );
      $("startBtn").disabled = false;
      $("startBtn").textContent = `${state.selectedCourse}問で開始する`;
    }),
);
document.querySelectorAll(".timer-option").forEach((button) => {
  button.onclick = () => {
    state.countdownEnabled = button.dataset.timer === "on";
    document.querySelectorAll(".timer-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", selected);
    });
  };
});
$("startBtn").onclick = () => start(state.selectedCourse);
$("weakStartBtn").onclick = () => {
  const weakWords = new Set(getWeakWords());
  const weakQuestions = QUESTIONS.filter((question) => weakWords.has(question.word));
  if (weakQuestions.length) start(weakQuestions.length, weakQuestions);
};
$("bookmark").onclick = () => {
  const word = state.questions[state.index].word;
  state.bookmarks.has(word)
    ? state.bookmarks.delete(word)
    : state.bookmarks.add(word);
  render();
};
$("retryBtn").onclick = () => start(state.courseCount);
$("reviewBtn").onclick = () => start(state.wrong.length, state.wrong);
$("homeBtn").onclick = showHome;
$("closeBtn").onclick = showHome;
$("menuBtn").onclick = showHome;
$("clearHistoryBtn").onclick = () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};
window.addEventListener("resize", fitWordOnOneLine);
showHome();
