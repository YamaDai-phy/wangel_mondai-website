import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wrangler = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
const records = [
  ["f9136141-f233-5ef4-b013-1d32fb30cbcd", "shizekan-nanakunimi,noro.pdf"],
  ["3b08df12-ea65-5836-be68-73099b8230e0", "shizekan-nanakunimi,noro2.pdf"],
  ["42be13d4-78e3-540b-a63c-38dd6e4f7892", "shizekan-nanakunimi,noro3.pdf"],
  ["c38770c4-a4ed-55a2-ab13-36371263aaa1", "shizekan-nanakunimi,noro4.pdf"],
].map(([id, filename]) => ({
  id,
  filename,
  oldKey: `library/pdf/kadai/shizekan/${filename}`,
  newKey: `tournaments/2018-県総体/shizekan/${id}/${filename}`,
}));

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], { cwd: workerDir, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`wrangler exited with code ${code}`)));
  });
}
function sql(value) { return `'${String(value).replaceAll("'", "''")}'`; }

if (!process.argv.includes("--execute")) {
  records.forEach(({ oldKey, newKey }) => console.log(`${oldKey} -> ${newKey}`));
  console.log("Run with --execute to perform the migration.");
  process.exit(0);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "wangel-r2-move-"));
try {
  for (const record of records) {
    const file = join(temporaryDirectory, `${record.id}.pdf`);
    await run(["r2", "object", "get", `pdf-storage/${record.oldKey}`, "--remote", "--file", file]);
    await run(["r2", "object", "put", `pdf-storage/${record.newKey}`, "--remote", "--file", file, "--content-type", "application/pdf"]);
    await run(["d1", "execute", "wangel-papers", "--remote", "--command", `UPDATE submissions SET r2_key = ${sql(record.newKey)}, file_kind = 'self_made', tournament_name = '県総体', tournament_year = '2018' WHERE id = ${sql(record.id)} AND r2_key = ${sql(record.oldKey)}`]);
    await run(["r2", "object", "delete", `pdf-storage/${record.oldKey}`, "--remote"]);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
