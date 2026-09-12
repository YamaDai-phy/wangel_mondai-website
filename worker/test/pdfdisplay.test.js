import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const html = await readFile(new URL("../../site/pdf.html", import.meta.url), "utf8");
const script = await readFile(new URL("../../site/pdfdisplay.js", import.meta.url), "utf8");

async function setup(query = "", fail = false) {
  const nodes = new Map();
  class Element {
    constructor(tagName = "div") {
      this.tagName = tagName;
      this.children = [];
      this.dataset = {};
      this.listeners = {};
      this.classList = { add() {}, remove() {}, toggle() {} };
      this.style = {};
    }
    set id(value) { nodes.set(value, this); }
    set innerHTML(value) { this.children = []; }
    setAttribute() {}
    appendChild(child) { child.parentElement = this; this.children.push(child); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    querySelector(selector) {
      const path = selector.match(/data-path="([^"]+)"/)?.[1];
      for (const child of this.children) {
        if (path && child.dataset.path === path) return child;
        const match = child.querySelector(selector);
        if (match) return match;
      }
      return null;
    }
    scrollIntoView() { this.scrolled = true; }
  }
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) nodes.set(id, new Element());
  const details = new Element("section");
  const papers = ["インターハイ", "県総体", "chutaiyosen", "天気図", "混在", "気象"].map((category, i) => ({
    id: `id-${i}`, title: `paper-${i}`, filename: `paper-${i}.pdf`, path: `/files/${i}/paper.pdf`,
    category, fileKind: "past_exam",
  }));
  papers.push({ title: "self-made", filename: "self.pdf", path: "/files/self/self.pdf", category: "気象", fileKind: "self_made" });
  const errors = [];
  const copied = [];
  const shared = [];
  const location = { href: `https://example.com/pdf.html${query}` };
  runInNewContext(script, {
    document: {
      getElementById: (id) => nodes.get(id),
      querySelector: (selector) => selector.startsWith(".details-section") ? details : null,
      createElement: (tag) => new Element(tag),
      body: new Element("body"),
    },
    localStorage: { getItem: () => null },
    fetch: async () => ({ ok: !fail, json: async () => ({ papers }) }),
    URL, location,
    history: { replaceState: (_state, _title, url) => { location.href = url; } },
    navigator: {
      clipboard: { writeText: async (text) => copied.push(text) },
      share: async (data) => shared.push(data),
    },
    console: { error: (...args) => errors.push(args) },
    setTimeout: () => {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { nodes, papers, errors, copied, shared, location };
}

test("一覧と検索は、表示欄が削除された大会のファイルも表示する", async () => {
  const { nodes, papers, errors } = await setup();
  assert.deepEqual(errors, []);
  const expectedLists = ["other-list", "other-list", "other-list", "tenkizu-list", "mixed-list", "kisho-list", "self-made-kisho-list"];
  for (const [i, paper] of papers.entries()) {
    const list = nodes.get(expectedLists[i]);
    const row = list?.querySelector(`tbody tr[data-path="${paper.path}"]`);
    assert.ok(row, `${paper.category} must have a visible row`);
    nodes.get("pdf-search").listeners.input({ target: { value: paper.title } });
    const result = nodes.get("search-results").children[0];
    assert.ok(result, "search result must exist");
    result.listeners.click();
    assert.equal(row.scrolled, true, "search must scroll to the rendered row");
  }
});

test("選択したファイルからクエリ付きリストを作り、URLをコピー・共有する", async () => {
  const { nodes, papers, copied, shared, location, errors } = await setup();
  for (const index of [2, 0]) {
    const row = nodes.get("other-list").querySelector(`tr[data-path="${papers[index].path}"]`);
    const checkbox = row.children[0].children[0];
    checkbox.checked = true;
    checkbox.listeners.change();
  }
  nodes.get("share-selected-files").listeners.click();
  assert.equal(new URL(location.href).searchParams.get("share"), "id-2,id-0");
  assert.equal(nodes.get("shared-list-section").hidden, false);
  const rows = nodes.get("shared-list").children[0].children[1].children;
  assert.deepEqual(rows.map(row => row.dataset.path), [papers[2].path, papers[0].path]);
  await nodes.get("copy-shared-list").listeners.click();
  await nodes.get("share-shared-list").listeners.click();
  assert.equal(copied[0], location.href);
  assert.equal(shared[0].url, location.href);
  assert.equal(shared[0].text, undefined);
  assert.deepEqual(errors, []);
});

test("共有リンクを開くと順序を保ち、重複を除いて表示し、不明なIDを案内する", async () => {
  const { nodes, papers, errors } = await setup("?share=id-2,id-0,id-2,missing");
  const rows = nodes.get("shared-list").children[0].children[1].children;
  assert.deepEqual(rows.map(row => row.dataset.path), [papers[2].path, papers[0].path]);
  assert.match(nodes.get("shared-list-status").textContent, /1件は削除・非公開/);
  assert.equal(nodes.get("shared-list-section").hidden, false);
  assert.deepEqual(errors, []);
});

test("一覧の取得失敗を、共有ファイルの削除と区別して案内する", async () => {
  const { nodes, errors } = await setup("?share=id-0", true);
  assert.match(nodes.get("shared-list-status").textContent, /読み込めませんでした/);
  assert.equal(errors.length, 1);
});
