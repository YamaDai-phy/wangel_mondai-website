import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const workerDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wrangler = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
const query = "SELECT id, r2_key, filename, subject FROM submissions WHERE ((r2_key LIKE 'library/pdf/kadai/kishou/%' AND filename NOT IN ('kishou19.pdf', 'kishou19-kotae.pdf')) OR r2_key LIKE 'library/pdf/kadai/kyukyu/kyukyu1.pdf' OR r2_key LIKE 'library/pdf/kadai/kyukyu/kyukyu2.pdf' OR r2_key LIKE 'library/pdf/kadai/kyukyu/kyukyu3.pdf' OR r2_key LIKE 'library/pdf/kadai/kyukyu/kyukyu4.pdf' OR r2_key LIKE 'library/pdf/kadai/kyukyu/kyukyu50attack%.pdf')";
const run = (args) => exec(process.execPath, [wrangler, ...args], { cwd: workerDir });
const contentType = (name) => /\.jpe?g$/i.test(name) ? "image/jpeg" : /\.txt$/i.test(name) ? "text/plain; charset=utf-8" : "application/pdf";

const { stdout } = await run(["d1", "execute", "wangel-papers", "--remote", "--json", "--command", query]);
const records = JSON.parse(stdout)[0].results.map((record) => ({ ...record, slug: record.subject === "気象" ? "kishou" : "kyukyu" }));
if (!process.argv.includes("--execute")) {
  console.log(`${records.length} records: run with --execute to migrate.`);
  process.exit(0);
}
const temp = await mkdtemp(join(tmpdir(), "wangel-r2-move-"));
try {
  await Promise.all(records.map(async (record) => {
    const file = join(temp, record.id);
    const nextKey = `self-made/${record.slug}/${record.id}/${record.filename}`;
    await run(["r2", "object", "get", `pdf-storage/${record.r2_key}`, "--remote", "--file", file]);
    await run(["r2", "object", "put", `pdf-storage/${nextKey}`, "--remote", "--file", file, "--content-type", contentType(record.filename)]);
    await run(["d1", "execute", "wangel-papers", "--remote", "--command", `UPDATE submissions SET r2_key = '${nextKey}', file_kind = 'self_made', tournament_name = '', tournament_year = '' WHERE id = '${record.id}' AND r2_key = '${record.r2_key}'`]);
    await run(["r2", "object", "delete", `pdf-storage/${record.r2_key}`, "--remote"]);
  }));
} finally { await rm(temp, { recursive: true, force: true }); }
console.log(`Moved ${records.length} generic self-made papers.`);
