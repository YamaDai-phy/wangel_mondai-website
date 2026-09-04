import { createHash } from "node:crypto";
import { readFile, stat, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = resolve(workerDir, "..");
const manifestPath = join(rootDir, "site", "pdf", "data.json");
const bucket = "pdf-storage";
const database = "wangel-papers";
const wrangler = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
const { papers } = JSON.parse(await readFile(manifestPath, "utf8"));

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], { cwd: workerDir, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0
      ? resolvePromise()
      : reject(new Error(`wrangler exited with code ${code}`)));
  });
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stableId(path) {
  const hex = createHash("sha256").update(`legacy:${path}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function contentType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function subjectFor(category) {
  return ({
    "chutaiyosen": "中国大会予選",
    "インターハイ": "2026インハイ",
    "県総体": "県総体",
  })[category] || category;
}

function docTypeFor(paper) {
  return /(?:kotae|-kotae|答え|解答)/i.test(`${paper.filename} ${paper.title}`) ? "answer" : "question";
}

const records = [];
for (const paper of papers) {
  const localPath = join(rootDir, "site", ...paper.path.split("/"));
  const info = await stat(localPath);
  const id = stableId(paper.path);
  records.push({ ...paper, id, localPath, size: info.size, r2Key: `library/${paper.path}` });
}

let cursor = 0;
const concurrency = 4;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < records.length) {
    const record = records[cursor++];
    console.log(`[${cursor}/${records.length}] ${record.r2Key}`);
    await run([
      "r2", "object", "put", `${bucket}/${record.r2Key}`,
      "--remote", "--file", record.localPath, "--content-type", contentType(record.filename),
    ]);
  }
}));

const statements = records.map((record) => {
  const createdAt = record.mtime || new Date().toISOString();
  return `INSERT OR IGNORE INTO submissions
    (id, r2_key, filename, title, uploader, subject, category, doc_type, status,
     review_token_hash, size, created_at, reviewed_at, tournament_name, tournament_year, file_kind)
    VALUES (${[
      record.id, record.r2Key, record.filename, record.title, "既存データ",
      subjectFor(record.category), record.category, docTypeFor(record), "published", null,
      record.size, createdAt, createdAt, record.tournament || "", "", "past_exam",
    ].map(sql).join(", ")});`;
}).join("\n");

const sqlPath = join(tmpdir(), `wangel-library-${Date.now()}.sql`);
await writeFile(sqlPath, statements, "utf8");
try {
  await run(["d1", "execute", database, "--remote", "--file", sqlPath]);
} finally {
  await unlink(sqlPath).catch(() => {});
}

console.log(`Migrated ${records.length} library files to R2 and D1.`);
