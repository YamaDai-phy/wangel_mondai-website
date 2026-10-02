const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup(mode) {
  const elements = new Map();
  const make = () => ({
    style: {}, classList: { add() {}, toggle() {} }, children: [],
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); },
    replaceChildren(...items) { this.children = items; },
    setAttribute() {},
    set innerHTML(value) { this.children = []; },
  });
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, make());
    return elements.get(id);
  };
  const saved = new Map();
  const pending = new Map();
  let timer = 0;
  const context = vm.createContext({
    document: {
      getElementById: get,
      createElement: make,
      createTextNode: (text) => ({ textContent: text }),
      querySelector: () => ({ value: mode }),
      querySelectorAll: (selector) => selector === ".choice" ? get("choices").children : [],
    },
    window: { addEventListener() {} },
    localStorage: {
      getItem: (key) => saved.get(key),
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout: (callback) => { pending.set(++timer, callback); return timer; },
    clearTimeout: (id) => pending.delete(id),
  });
  vm.runInContext(fs.readFileSync(__dirname + "/questions.js", "utf8"), context);
  vm.runInContext(fs.readFileSync(__dirname + "/app.js", "utf8"), context);
  return { context, get, pending, run: (code) => vm.runInContext(code, context) };
}

for (const mode of ["name", "symbol"]) {
  test(mode + ": answer, result, history and review", () => {
    const app = setup(mode);
    app.run("start(1)");
    assert.equal(app.get("choices").children.length, 4);
    if (mode === "name") assert.match(app.get("word").children[0].src, /\.svg$/);
    else assert(app.get("choices").children.every((button) => button.children[1].src.endsWith(".svg")));
    app.run("answer((state.questions[0].answerIndex + 1) % 4)");
    assert(app.get("choices").children.every((button) => button.disabled));
    [...app.pending.values()][0]();
    assert.equal(app.get("resultScreen").hidden, false);
    assert.equal(app.run("getHistory().length"), 1);
    assert.equal(app.run("getWeakWords().length"), 1);
    app.get("reviewBtn").onclick();
    app.run("answer(state.questions[0].answerIndex)");
    assert.equal(app.run("getWeakWords().length"), 0);
  });
  test(mode + ": leaving cancels pending transition", () => {
    const app = setup(mode);
    app.run("start(1); answer(-1); showHome()");
    assert.equal(app.pending.size, 0);
    assert.equal(app.get("quizScreen").hidden, true);
  });
}
