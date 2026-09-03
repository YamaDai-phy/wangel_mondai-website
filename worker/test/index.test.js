import test from "node:test";
import assert from "node:assert/strict";
import { createCorsHeaders, validateUpload } from "../src/index.js";

function validForm(overrides = {}) {
  const values = {
    file: new File(["%PDF-1.7"], "sample.pdf", { type: "application/pdf" }),
    doc_type: "question",
    subject: "自然観察",
    filename: "sample.pdf",
    title: "サンプル問題",
    uploader: "投稿者",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("有効な投稿を正規化する", async () => {
  const input = await validateUpload(validForm());
  assert.equal(input.subject, "自然観察");
  assert.equal(input.filename, "sample.pdf");
});

test("未完成品を受け付ける", async () => {
  const input = await validateUpload(validForm({ doc_type: "incomplete" }));
  assert.equal(input.docType, "incomplete");
});

test("日本語のPDFファイル名を受け付ける", async () => {
  const input = await validateUpload(validForm({ filename: "自然観察問題.pdf" }));
  assert.equal(input.filename, "自然観察問題.pdf");
});

test("不正なファイル名を拒否する", async () => {
  await assert.rejects(validateUpload(validForm({ filename: "../sample.pdf" })), /PDF形式/);
});

test("未登録の科目を拒否する", async () => {
  await assert.rejects(validateUpload(validForm({ subject: "その他" })), /担当科目/);
});

test("拡張子だけを偽装したファイルを拒否する", async () => {
  const fake = new File(["not a pdf"], "sample.pdf", { type: "application/pdf" });
  await assert.rejects(validateUpload(validForm({ file: fake })), /内容/);
});

test("設定されたサイズ上限を適用する", async () => {
  await assert.rejects(validateUpload(validForm(), 5), /0MB以下/);
});

test("許可されたOriginだけにCORSヘッダーを返す", () => {
  const allowed = createCorsHeaders("https://example.com", "https://example.com");
  assert.equal(allowed.get("Access-Control-Allow-Origin"), "https://example.com");
  assert.equal(createCorsHeaders("https://evil.example", "https://example.com"), null);
});
