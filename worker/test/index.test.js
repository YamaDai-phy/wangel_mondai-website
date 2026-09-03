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

test("保存パスをクライアント入力ではなく科目から生成する", async () => {
  const form = validForm();
  form.set("path", "../../invalid.pdf");
  assert.equal((await validateUpload(form)).savePath, "pdf/kadai/shizekan/sample.pdf");
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

test("許可されたOriginだけにCORSヘッダーを返す", () => {
  const allowed = createCorsHeaders("https://example.com", "https://example.com");
  assert.equal(allowed.get("Access-Control-Allow-Origin"), "https://example.com");
  assert.equal(createCorsHeaders("https://evil.example", "https://example.com"), null);
});
