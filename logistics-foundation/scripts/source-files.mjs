import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// 证据副本、基线与交付包共用此规则；源码摘要包括图片和清单，不包括运行产物。
const excludedNames = new Set(["node_modules", ".next", ".git", "artifacts", "evidence", ".DS_Store"]);
export function isSourcePath(relative) {
  const parts = relative.split(/[\\/]/);
  if (parts.some(part => excludedNames.has(part))) return false;
  const name = parts.at(-1);
  if (/\.(?:db|sqlite|sqlite3)(?:-(?:journal|wal|shm))?$|\.tsbuildinfo$/i.test(name)) return false;
  if ((name === ".env" || name.startsWith(".env.")) && ![".env.example", ".env.sample"].includes(name)) return false;
  return true;
}

export async function sourceFiles(root, prefix = "") {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!isSourcePath(relative)) continue;
    if (entry.isSymbolicLink()) throw new Error(`源码中不允许指向副本外的符号链接: ${relative}`);
    if (entry.isDirectory()) files.push(...await sourceFiles(root, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

export async function copySourceTree(from, to) {
  for (const relative of await sourceFiles(from)) {
    const target = path.join(to, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(from, relative), target);
  }
}

export async function sourceDigest(root) {
  const files = await sourceFiles(root);
  const hash = createHash("sha256");
  for (const relative of files) {
    const digest = createHash("sha256").update(await fs.readFile(path.join(root, relative))).digest("hex");
    hash.update(`${relative}\u0000${digest}\n`);
  }
  return { algorithm: "sha256-path-nul-filehash-v2", sha256: hash.digest("hex"), fileCount: files.length };
}
