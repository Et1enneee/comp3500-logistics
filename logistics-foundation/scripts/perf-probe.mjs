import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * 性能测量（NFR-01/02）：明确记录环境、样本量、冷热状态与测量区间。
 * - API：每个端点 3 次预热 + 30 次顺序请求，报告 mean/max/p95。
 * - 界面：生产构建下，从 goto 到列表首行可见的时间，3 次取样。
 * 失败如实暴露（退出码非 0），不删慢样本。
 */
const BASE = process.env.PERF_BASE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(BASE).hostname)) throw new Error("只允许本机测量");
const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const SAMPLES = Number(process.env.PERF_SAMPLES || 30);
const UI_SAMPLES = Number(process.env.PERF_UI_SAMPLES || 3);
const OUT = path.resolve(process.env.PERF_OUTPUT || "docs/evidence/performance.json");

const db = new PrismaClient();

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  return {
    samples: samples.map(value => Number(value.toFixed(1))),
    count: samples.length,
    meanMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(1)),
    maxMs: Number(Math.max(...samples).toFixed(1)),
    p95Ms: Number(sorted[rank].toFixed(1)),
  };
}

async function login(email) {
  const response = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`登录失败 ${email}: ${response.status}`);
  const cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie.includes("g42_session=")) throw new Error("未收到会话 Cookie");
  return cookie;
}

async function timeRequest(url, cookie) {
  const started = performance.now();
  const response = await fetch(url, { headers: { cookie } });
  const body = await response.text();
  const elapsed = performance.now() - started;
  if (!response.ok) throw new Error(`${url} -> ${response.status}: ${body.slice(0, 200)}`);
  return elapsed;
}

async function apiProbe(name, url, cookie) {
  for (let index = 0; index < 3; index++) await timeRequest(url, cookie);
  const samples = [];
  for (let index = 0; index < SAMPLES; index++) samples.push(await timeRequest(url, cookie));
  return { name, url, method: "GET", ...stats(samples) };
}

async function uiProbe(browser, name, pathName, email, waitSelector) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + "/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/login")),
    page.getByRole("button", { name: "登录", exact: true }).click(),
  ]);
  const samples = [];
  for (let index = 0; index < UI_SAMPLES; index++) {
    const started = performance.now();
    await page.goto(BASE + pathName, { waitUntil: "domcontentloaded" });
    await page.locator(waitSelector).first().waitFor({ state: "visible", timeout: 15000 });
    samples.push(performance.now() - started);
  }
  const result = { name, path: pathName, metric: "goto → 首行/首卡可见", ...stats(samples) };
  await context.close();
  return result;
}

async function main() {
  const fixture = {
    orders: await db.order.count(),
    products: await db.product.count(),
    notifications: await db.notification.count(),
    inventoryLogs: await db.inventoryLog.count(),
  };
  const customerCookie = await login("customer.a@demo.com");
  const staffCookie = await login("staff@demo.com");
  const adminCookie = await login("admin@demo.com");

  const api = [];
  api.push(await apiProbe("orders.list", BASE + "/api/v1/orders?page=1&pageSize=10", customerCookie));
  api.push(await apiProbe("orders.list.filtered", BASE + "/api/v1/orders?page=2&pageSize=10&status=DELIVERED", customerCookie));
  api.push(await apiProbe("inventory.list", BASE + "/api/v1/inventory?page=1&pageSize=20", staffCookie));
  api.push(await apiProbe("inventory.logs", BASE + "/api/v1/inventory/logs?page=1&pageSize=20", staffCookie));
  api.push(await apiProbe("notifications.list", BASE + "/api/v1/notifications?page=1&pageSize=10", customerCookie));
  api.push(await apiProbe("reports.overview", BASE + "/api/v1/reports/overview", adminCookie));

  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const ui = [];
  try {
    ui.push(await uiProbe(browser, "customer.orders", "/orders", "customer.a@demo.com", "tbody tr"));
    ui.push(await uiProbe(browser, "staff.queue", "/staff", "staff@demo.com", "tbody tr"));
    ui.push(await uiProbe(browser, "admin.dashboard", "/admin", "admin@demo.com", '[data-testid="stat-orders"]'));
  } finally {
    await browser.close();
  }

  const report = {
    measuredAt: new Date().toISOString(),
    baseUrl: BASE,
    buildMode: "production (next build + next start)",
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      cpuModel: os.cpus()[0]?.model ?? "unknown",
      cpuCount: os.cpus().length,
      totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    },
    methodology: {
      api: `${SAMPLES} 次顺序请求（每端点先 3 次预热），测量完整 HTTP 往返含响应体读取；同一进程、单用户 Cookie，本机回环。`,
      ui: `${UI_SAMPLES} 次生产构建页面导航，度量 goto 到列表首行/首个统计卡可见；单 Chromium 无缓存清空，非首次冷启动。`,
      targets: { apiLocalP95: "≤ 2000ms", uiFirstContentP95: "≤ 3000ms" },
      caveat: "本机回环测量，不代表公网或高并发；未做长时间可用性测试。",
    },
    fixture,
    api,
    ui,
    targetsMet: {
      api: api.every(entry => entry.p95Ms <= 2000),
      ui: ui.every(entry => entry.p95Ms <= 3000),
    },
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(report, null, 2));
  console.log(`API p95: ${api.map(entry => `${entry.name}=${entry.p95Ms}ms`).join(", ")}`);
  console.log(`UI p95: ${ui.map(entry => `${entry.name}=${entry.p95Ms}ms`).join(", ")}`);
  console.log(`目标达成: API=${report.targetsMet.api} UI=${report.targetsMet.ui}`);
  if (!report.targetsMet.api || !report.targetsMet.ui) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
