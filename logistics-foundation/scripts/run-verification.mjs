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

// 没有调用者显式确认时，在安装、创建输出目录或任何数据库操作之前退出。
if (process.env.RESET_DEMO_DATA !== "YES") {
  console.error("拒绝运行：请显式设置 RESET_DEMO_DATA=YES。证据流程仅在独立临时源码副本中初始化可丢弃库，不连接当前项目数据库。");
  process.exitCode = 1;
} else {
  const originalCwd = process.cwd();
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const evidenceRoot = path.resolve(process.env.EVIDENCE_ROOT || "../evidence");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "g42-evidence-"));
  const isolated = path.join(temporary, "logistics-foundation");
  try {
    const before = await sourceDigest(projectDir);
    const databasesBefore = await databaseSnapshot(projectDir);
    await copySourceTree(projectDir, isolated);
    const copied = await sourceDigest(isolated);
    if (JSON.stringify(copied) !== JSON.stringify(before)) throw new Error("临时副本源码摘要不匹配");
    console.log("证据流程：临时副本 + 全新可丢弃数据库；原项目数据库不参与运行。");
    process.chdir(isolated);
    await runVerification({ evidenceRoot });
    const databasesAfter = await databaseSnapshot(projectDir);
    const originalDatabaseUnchanged = JSON.stringify(databasesBefore) === JSON.stringify(databasesAfter);
    await fs.writeFile(path.join(evidenceRoot, "isolation-check.json"), JSON.stringify({
      mode: "disposable-source-copy", explicitResetConfirmation: true,
      originalDatabaseUnchanged, before: databasesBefore, after: databasesAfter,
    }, null, 2) + "\n");
    if (!originalDatabaseUnchanged) throw new Error("原数据库在验证期间发生变化，请检查并发写入后重试");
    const after = await sourceDigest(projectDir);
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error("运行期间原源码发生变化，请重新生成证据");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    process.chdir(originalCwd);
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
