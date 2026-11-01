import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { copySourceTree, sourceDigest } from "../scripts/source-files.mjs";

test("evidence refuses to run without explicit caller confirmation", async () => {
  const output = path.join(os.tmpdir(), `evidence-refused-${Date.now()}`);
  const result = spawnSync(process.execPath, ["scripts/run-verification.mjs"], {
    env: { ...process.env, RESET_DEMO_DATA: "", EVIDENCE_ROOT: output }, encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RESET_DEMO_DATA=YES/);
  await assert.rejects(fs.stat(output), { code: "ENOENT" });
});

test("packaged and verified source have identical digests despite local runtime files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "delivery-check-"));
  const source = path.join(root, "source");
  const target = path.join(root, "package");
  try {
    const files = {
      "app/page.tsx": "export default 42", "public/icon.png": "bitmap", "package-lock.json": "{}",
      "tsconfig.tsbuildinfo": "cache", "prisma/dev.db": "KEEP-THIS-DATABASE",
      "prisma/dev.db-wal": "wal", ".env.local": "secret", ".env.example": "DEMO_PASSWORD=",
      "artifacts/results.json": "old", "docs/evidence/old.png": "old screenshot",
      "node_modules/pkg/index.js": "dependency", ".next/build.js": "generated",
    };
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(source, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, text);
    }
    const before = await sourceDigest(source);
    assert.equal(before.fileCount, 4);
    await copySourceTree(source, target);
    assert.deepEqual(await sourceDigest(target), before);
    await assert.rejects(fs.stat(path.join(target, "prisma/dev.db")), { code: "ENOENT" });
    assert.equal(await fs.readFile(path.join(source, "prisma/dev.db"), "utf8"), "KEEP-THIS-DATABASE");
    await fs.writeFile(path.join(source, "tsconfig.tsbuildinfo"), "another cache");
    assert.deepEqual(await sourceDigest(source), before);
    await fs.writeFile(path.join(target, "app/page.tsx"), "real source edit");
    assert.notDeepEqual(await sourceDigest(target), before);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
