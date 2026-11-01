import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "./source-files.mjs";

/**
 * 生成当前源码清单：
 *   BASELINE-v0.4.2.json  —— 每个源文件的 SHA-256 + 来源信息
 *   SHA256SUMS.txt        —— `sha256sum -c` 可直接校验（路径相对本目录）
 * 不包含 node_modules、构建产物、数据库、运行证据、清单自身。
 */
const root = process.cwd();
const files = (await sourceFiles(root))
  .filter(file => !["SHA256SUMS.txt", "BASELINE-v0.4.2.json"].includes(file))
  .map(file => path.join(root, file));
const hashes = {};
const lines = [];
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const digest = createHash("sha256").update(await fs.readFile(file)).digest("hex");
  hashes[relative] = digest;
  lines.push(`${digest}  ${relative}`);
}

const baseline = {
  version: "v0.4.2-delivery",
  created_at_utc: new Date().toISOString(),
  derived_from: {
    upstream_commit: "eddab17be9a29b7fb11769b60ac6afce1b3288c0",
    upstream_source_zip_sha256: "92b1a918b99e99245079ef70e1761df55c83598f857f4760fd94c0190c545d24",
    note: "在已验收 v0.3.1 底座上增量开发；未重写业务主链，未升级框架或 Prisma 大版本。",
  },
  file_count: Object.keys(hashes).length,
  source_files: hashes,
  verification_summary: {
    counts_source: "以本轮 evidence/results.json 的 summary 实测统计为准；基线不预填测试数量。",
    migrations: ["20261013114356_init", "20261030120000_auth_inventory_notifications"],
    evidence: "证据包 evidence/results.json 记录每步命令、退出码、耗时与源码摘要。",
  },
};

await fs.writeFile(path.join(root, "BASELINE-v0.4.2.json"), JSON.stringify(baseline, null, 2) + "\n");
await fs.writeFile(path.join(root, "SHA256SUMS.txt"), lines.join("\n") + "\n");
console.log(`baseline files: ${baseline.file_count}`);
