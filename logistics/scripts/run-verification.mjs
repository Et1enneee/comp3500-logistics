import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copySourceTree, sourceDigest } from "./source-files.mjs";
import { runVerification } from "./verification-worker.mjs";

async function databaseSnapshot(projectDir) {
  const directory = path.join(projectDir, "prisma");
  const snapshot = {};
  for (const name of (await fs.readdir(directory)).sort()) {
    if (!/\.(?:db|sqlite|sqlite3)(?:-(?:journal|wal|shm))?$/i.test(name)) continue;
    snapshot[`prisma/${name}`] = createHash("sha256").update(await fs.readFile(path.join(directory, name))).digest("hex");
  }
  return snapshot;
}

// Unless the caller explicitly confirms, exit before installing, creating output directories, or touching any database.
if (process.env.RESET_DEMO_DATA !== "YES") {
  console.error("Refusing to run: set RESET_DEMO_DATA=YES explicitly. The evidence flow only initializes a disposable database inside an isolated temporary source copy and never connects to the current project database.");
  process.exitCode = 1;
} else {
  const originalCwd = process.cwd();
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const evidenceRoot = path.resolve(process.env.EVIDENCE_ROOT || "../evidence");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "g42-evidence-"));
  const isolated = path.join(temporary, "logistics");
  try {
    const before = await sourceDigest(projectDir);
    const databasesBefore = await databaseSnapshot(projectDir);
    await copySourceTree(projectDir, isolated);
    const copied = await sourceDigest(isolated);
    if (JSON.stringify(copied) !== JSON.stringify(before)) throw new Error("source digest mismatch in the temporary copy");
    console.log("Evidence flow: temporary copy + fresh disposable database; the original project database is not involved in the run.");
    process.chdir(isolated);
    await runVerification({ evidenceRoot });
    const databasesAfter = await databaseSnapshot(projectDir);
    const originalDatabaseUnchanged = JSON.stringify(databasesBefore) === JSON.stringify(databasesAfter);
    await fs.writeFile(path.join(evidenceRoot, "isolation-check.json"), JSON.stringify({
      mode: "disposable-source-copy", explicitResetConfirmation: true,
      originalDatabaseUnchanged, before: databasesBefore, after: databasesAfter,
    }, null, 2) + "\n");
    if (!originalDatabaseUnchanged) throw new Error("The original database changed during verification; check for concurrent writes and retry");
    const after = await sourceDigest(projectDir);
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error("The original source changed during the run; regenerate the evidence");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    process.chdir(originalCwd);
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
