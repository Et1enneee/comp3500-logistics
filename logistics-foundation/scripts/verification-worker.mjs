import { spawn } from "node:child_process";
import { sourceDigest } from "./source-files.mjs";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * 证据总控脚本：真实执行全部检查，原始 stdout/stderr 与退出码落盘。
 * 输出（默认 ../evidence，可用 EVIDENCE_ROOT 覆盖）：
 *   test-logs/*.log, screenshots/*.png, results.json, performance.json, audit.json
 * 不伪造任何结果；某一步失败仍继续跑完其余步骤，但最终退出码非 0。
 */
export async function runVerification({ evidenceRoot }) {
const projectDir = process.cwd();
const logsDir = path.join(evidenceRoot, "test-logs");
const screenshotsDir = path.join(evidenceRoot, "screenshots");
const port = Number(process.env.EVIDENCE_PORT || 3100);
const baseUrl = `http://127.0.0.1:${port}`;
const steps = [];
const startedAt = new Date().toISOString();
const env = {
  node: process.version,
  npm: process.env.npm_config_user_agent || "unknown",
  platform: `${os.platform()} ${os.release()}`,
  arch: os.arch(),
  cpuModel: os.cpus()[0]?.model ?? "unknown",
  cpuCount: os.cpus().length,
  totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
  cwd: ".",
};

await fs.mkdir(logsDir, { recursive: true });
await fs.mkdir(screenshotsDir, { recursive: true });

function run(name, command, args, options = {}) {
  return new Promise(resolve => {
    const logPath = path.join(logsDir, `${name}.log`);
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: ".",
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let stdout = "";
    const collect = chunk => {
      output += chunk.toString();
      process.stdout.write(chunk);
    };
    child.stdout.on("data", chunk => { stdout += chunk.toString(); collect(chunk); });
    child.stderr.on("data", collect);
    child.on("error", error => collect(Buffer.from(String(error))));
    child.on("close", async code => {
      const header = `# command: ${command} ${args.join(" ")}\n# cwd: ${projectDir}\n# exit: ${code}\n# durationMs: ${Date.now() - started}\n# startedAt: ${new Date(started).toISOString()}\n\n`;
      await fs.writeFile(logPath, header + output);
      if (options.stdoutFile) await fs.writeFile(options.stdoutFile, stdout);
      const result = {
        name,
        ...(["unit", "integration", "delivery"].includes(name) ? {
          testCount: Number((output.replace(/\x1b\[[0-9;]*m/g, "").match(name === "unit" ? /Tests\s+(\d+)\s+passed/ : /tests\s+(\d+)/) ?? [])[1]) || null,
        } : {}),
        command: [command, ...args].join(" "),
        exitCode: code ?? 1,
        optional: Boolean(options.optional),
        status: (code ?? 1) === 0 ? "passed" : options.optional ? "known-issue" : "failed",
        durationMs: Date.now() - started,
        log: path.relative(evidenceRoot, logPath).split(path.sep).join("/"),
        tail: output.trim().split("\n").slice(-6).join("\n"),
      };
      steps.push(result);
      resolve(result);
    });
  });
}

/** 证据脱敏：把本机绝对路径替换为符号，保留其余原始输出。 */
async function sanitizeEvidence() {
  const replacements = [
    [projectDir, "."],
    [os.homedir(), "~"],
    [os.tmpdir(), "$TMP"],
  ];
  const files = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(log|json|txt)$/.test(entry.name) && entry.name !== "results.json") files.push(full);
    }
  }
  await walk(evidenceRoot);
  for (const file of files) {
    let text = await fs.readFile(file, "utf8");
    const original = text;
    for (const [from, to] of replacements) {
      if (from && from.length > 1) text = text.split(from).join(to);
    }
    if (text !== original) await fs.writeFile(file, text);
  }
}

let server;
async function startServer() {
  const logPath = path.join(logsDir, "server.log");
  const stream = createWriteStream(logPath, { flags: "a" });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: ".",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(stream);
  server.stderr.pipe(stream);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(baseUrl + "/login");
      if (response.ok) return true;
    } catch {
      // 未就绪
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("服务器未能在 60 秒内就绪，见 test-logs/server.log");
}

async function stopServer() {
  if (!server) return;
  server.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 1500));
  server = undefined;
}

async function loginForCheck(email, password) {
  const response = await fetch(baseUrl + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`login ${email} -> ${response.status}`);
  const cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  const data = await response.json();
  return { cookie, csrf: data.csrfToken };
}

/**
 * 重启保留检查（P1-D）：创建订单 → 重启服务 → 同一 Cookie 会话与订单/库存仍在。
 */
async function restartCheck() {
  const password = process.env.DEMO_PASSWORD || "Demo1234!";
  const customer = await loginForCheck("customer.a@demo.com", password);
  const staff = await loginForCheck("staff@demo.com", password);
  const createResponse = await fetch(baseUrl + "/api/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: customer.cookie, "x-csrf-token": customer.csrf },
    body: JSON.stringify({ items: [{ sku: "SKU001", quantity: 1 }] }),
  });
  if (createResponse.status !== 201) throw new Error(`create -> ${createResponse.status}`);
  const before = await createResponse.json();
  const stockBefore = await (await fetch(baseUrl + "/api/v1/inventory?sku=SKU001", { headers: { cookie: staff.cookie } })).json();

  await stopServer();
  await startServer();

  const detailResponse = await fetch(
    baseUrl + `/api/v1/orders?orderNumber=${encodeURIComponent(before.order.orderNumber)}`,
    { headers: { cookie: customer.cookie } },
  );
  const detail = await detailResponse.json();
  const sessionResponse = await fetch(baseUrl + "/api/v1/auth/me", { headers: { cookie: customer.cookie } });
  const stockAfter = await (await fetch(baseUrl + "/api/v1/inventory?sku=SKU001", { headers: { cookie: staff.cookie } })).json();
  const report = {
    checkedAt: new Date().toISOString(),
    orderNumber: before.order.orderNumber,
    orderSurvivedRestart: detailResponse.status === 200 && detail.order?.id === before.order.id,
    sessionSurvivedRestart: sessionResponse.status === 200,
    stockUnchanged: stockAfter.products?.[0]?.stock === stockBefore.products?.[0]?.stock,
    stock: stockAfter.products?.[0]?.stock,
  };
  await fs.writeFile(path.join(evidenceRoot, "restart-check.json"), JSON.stringify(report, null, 2));
  if (!report.orderSurvivedRestart || !report.sessionSurvivedRestart || !report.stockUnchanged) {
    throw new Error("重启保留检查失败: " + JSON.stringify(report));
  }
  console.log("重启保留检查通过：订单、会话、库存均在");
  return report;
}

try {
  for (const [name, args] of [["install", ["ci"]], ["database", ["run", "db:setup"]], ["seed", ["run", "db:seed:demo"]]]) {
    const result = await run(name, "npm", args);
    if (result.exitCode !== 0) throw new Error(`${name} failed; stopping isolated verification`);
  }
  await run("delivery", "npm", ["run", "test:delivery"]);
  await run("typecheck", "npm", ["run", "typecheck"]);
  await run("unit", "npm", ["test"]);
  await run("integration", "npm", ["run", "test:integration"]);
  await run("lint", "npm", ["run", "lint"]);
  await run("build", "npm", ["run", "build"]);
  await run("migration", "npm", ["run", "verify:migration"], {
    env: { MIGRATION_REPORT: path.join(evidenceRoot, "migration-check.json") },
  });

  // 漏洞发现会使 npm audit 返回非零；不自动升级，完整保留两种安装范围的原始 stdout JSON。
  const auditSummary = { capturedAt: new Date().toISOString(), scans: {} };
  for (const [name, flags, file] of [["full", [], "audit.json"], ["omitDev", ["--omit=dev"], "audit-omit-dev.json"]]) {
    const result = await run(name === "full" ? "audit" : "audit-omit-dev", "npm", ["audit", ...flags, "--json"], {
      optional: true, stdoutFile: path.join(evidenceRoot, file),
    });
    const payload = JSON.parse(await fs.readFile(path.join(evidenceRoot, file), "utf8"));
    if (!payload.metadata?.vulnerabilities || !payload.vulnerabilities || payload.error) throw new Error(`audit ${name} 未返回有效扫描结果`);
    auditSummary.scans[name] = { file, exitCode: result.exitCode, counts: payload.metadata.vulnerabilities };
  }
  auditSummary.riskStatement = "完整扫描及 --omit=dev 均有未修复依赖风险；omit=dev 仍包含 prisma → @prisma/config → deepmerge-ts 的 high 链，不能将其排除为仅开发依赖或断言运行环境无风险。当前未证明业务 HTTP 路径可利用，也不以此推断不可利用。moderate 见 ESLint/minimatch 链原始 JSON。未执行 audit fix --force 或破坏性升级。";
  await fs.writeFile(path.join(evidenceRoot, "audit-summary.json"), JSON.stringify(auditSummary, null, 2) + "\n");

  const chromium = await run("chromium", "npx", ["playwright", "install", "chromium"]);
  if (chromium.exitCode !== 0) throw new Error("Chromium installation failed");
  await startServer();
  steps.push({ name: "server", command: `next start -H 127.0.0.1 -p ${port}`, exitCode: 0, optional: true, status: "passed", durationMs: 0, log: "test-logs/server.log", tail: "ready" });

  await run("performance", "node", ["scripts/perf-probe.mjs"], {
    env: { PERF_BASE_URL: baseUrl, PERF_OUTPUT: path.join(evidenceRoot, "performance.json") },
  });

  await run("browser", "node", ["scripts/browser-smoke.mjs"], {
    env: {
      FOUNDATION_BROWSER_TEST: "YES",
      FOUNDATION_BASE_URL: baseUrl,
      EVIDENCE_DIR: screenshotsDir,
    },
  });
  await stopServer();

  let restartReport = null;
  await startServer();
  try {
    restartReport = await restartCheck();
    steps.push({ name: "restart", command: "stop/start server + re-read", exitCode: 0, optional: false, status: "passed", durationMs: 0, log: "restart-check.json", tail: "order/session/stock survived" });
  } finally {
    await stopServer();
  }

  const browserResultsPath = path.join(screenshotsDir, "browser-results.json");
  let browserSummary = null;
  try {
    browserSummary = JSON.parse(await fs.readFile(browserResultsPath, "utf8"));
  } catch {
    browserSummary = null;
  }
  await sanitizeEvidence();
  const digest = await sourceDigest(projectDir);
  const failed = steps.filter(step => step.exitCode !== 0 && !step.optional);
  const results = {
    project: "Group42 logistics v0.4.2",
    audit: auditSummary,
    dataIsolation: { mode: "disposable-source-copy", explicitResetConfirmation: true, originalDatabaseUsed: false },
    startedAt,
    finishedAt: new Date().toISOString(),
    environment: env,
    sourceDigest: digest,
    steps,
    summary: {
      totalSteps: steps.length,
      unitTests: steps.find(step => step.name === "unit")?.testCount ?? null,
      integrationTests: steps.find(step => step.name === "integration")?.testCount ?? null,
      deliveryTests: steps.find(step => step.name === "delivery")?.testCount ?? null,
      failedSteps: failed.map(step => step.name),
      browserChecks: browserSummary?.passedCount ?? null,
      browserConsoleErrors: browserSummary?.consoleErrors ?? null,
      restartCheck: restartReport ? "passed" : "not-run",
    },
    notes: [
      "所有日志为本脚本实际执行的原始输出；仅把本机绝对路径脱敏为符号（项目根=.，家目录=~，临时目录=$TMP），其余未修改或美化。",
      "audit.json 与 audit-omit-dev.json 是本轮 npm audit 的原始 stdout JSON；audit-summary.json 记录实际数量、退出码和风险边界，不把 omit=dev 仍有的 high 说成已排除运行环境风险。未执行破坏性升级。",
      "浏览器截图由 Playwright 在真实运行的应用上生成，位于 screenshots/。",
    ],
  };
  await fs.writeFile(path.join(evidenceRoot, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n证据已写入 ${evidenceRoot}`);
  console.log(`步骤 ${steps.length} 个，失败 ${failed.length} 个${failed.length ? "：" + failed.map(step => step.name).join(", ") : ""}`);
  if (failed.length) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopServer();
}

}
