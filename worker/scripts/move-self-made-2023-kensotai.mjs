import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wrangler = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
const bucket = "pdf-storage";
const database = "wangel-papers";

// These records were uploaded as self-made 2023 県総体 papers, but had been
// stored under submissions/ and marked as past_exam before the folder policy.
const records = [
  ["151abd52-f8ff-4acb-a775-0ea89e1e96a6", "submissions/151abd52-f8ff-4acb-a775-0ea89e1e96a6/kishou22-kotae.pdf", "kishou", "kishou27-kotae.pdf"],
  ["914d7fc1-a07b-4dd6-b3ac-369be2023337", "submissions/914d7fc1-a07b-4dd6-b3ac-369be2023337/kishou22.pdf", "kishou", "kishou27.pdf"],
  ["785a6fb9-6133-4ada-9f04-3d6de54ec45a", "submissions/785a6fb9-6133-4ada-9f04-3d6de54ec45a/kyukyu6.pdf", "kyukyu", "kyukyu6.pdf"],
  ["ac7edc14-057a-4ab3-b5c2-393ac43d3e40", "submissions/ac7edc14-057a-4ab3-b5c2-393ac43d3e40/kyukyu6-kotae.pdf", "kyukyu", "kyukyu6-kotae.pdf"],
].map(([id, oldKey, slug, filename]) => ({
  id,
  oldKey,
  newKey: `tournaments/2023-県総体/${slug}/${id}/${filename}`,
}));

const requestedIds = process.argv.flatMap((argument, index, argumentsList) =>
  argument === "--id" ? [argumentsList[index + 1]] : [],
).filter(Boolean);
const selectedRecords = requestedIds.length
  ? records.filter(({ id }) => requestedIds.includes(id))
  : records;
if (requestedIds.length && selectedRecords.length !== requestedIds.length) {
  throw new Error("Unknown migration record ID.");
}

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
  return `'${String(value).replaceAll("'", "''")}'`;
}

if (!process.argv.includes("--execute")) {
  console.log("Dry run. The following four PDFs will be moved and marked self_made:");
  selectedRecords.forEach(({ oldKey, newKey }) => console.log(`${oldKey} -> ${newKey}`));
  console.log("Run with --execute to perform the migration.");
  process.exit(0);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "wangel-r2-move-"));
try {
  for (const record of selectedRecords) {
    const temporaryFile = join(temporaryDirectory, `${record.id}.pdf`);
    console.log(`Moving ${record.oldKey} -> ${record.newKey}`);
    await run(["r2", "object", "get", `${bucket}/${record.oldKey}`, "--remote", "--file", temporaryFile]);
    await run(["r2", "object", "put", `${bucket}/${record.newKey}`, "--remote", "--file", temporaryFile, "--content-type", "application/pdf"]);
    await run(["d1", "execute", database, "--remote", "--command",
      `UPDATE submissions SET r2_key = ${sql(record.newKey)}, file_kind = 'self_made' WHERE id = ${sql(record.id)} AND r2_key = ${sql(record.oldKey)}`,
    ]);
    await run(["r2", "object", "delete", `${bucket}/${record.oldKey}`, "--remote"]);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(`Moved ${selectedRecords.length} PDFs to tournament folders.`);
