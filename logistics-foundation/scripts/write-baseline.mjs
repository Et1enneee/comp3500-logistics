import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "./source-files.mjs";

/**
 * Generate the current source manifest:
 *   BASELINE-v0.4.2.json  —— SHA-256 of every source file + provenance info
 *   SHA256SUMS.txt        —— directly verifiable with `sha256sum -c` (paths relative to this directory)
 * Excludes node_modules, build output, databases, run evidence, and the manifests themselves.
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
    note: "Incremental development on the accepted v0.3.1 foundation; the core business chain was not rewritten, and neither the framework nor Prisma major versions were upgraded.",
  },
  file_count: Object.keys(hashes).length,
  source_files: hashes,
  verification_summary: {
    counts_source: "Test counts are taken from the measured summary in this round's evidence/results.json; the baseline does not pre-fill test counts.",
    migrations: ["20261013114356_init", "20261030120000_auth_inventory_notifications"],
    evidence: "The evidence package evidence/results.json records each step's command, exit code, duration, and source digest.",
  },
};

await fs.writeFile(path.join(root, "BASELINE-v0.4.2.json"), JSON.stringify(baseline, null, 2) + "\n");
await fs.writeFile(path.join(root, "SHA256SUMS.txt"), lines.join("\n") + "\n");
console.log(`baseline files: ${baseline.file_count}`);
