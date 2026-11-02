import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Performance measurement (NFR-01/02): explicitly records the environment, sample sizes, cold/warm state and measurement window.
 * - API: 3 warm-up + 30 sequential requests per endpoint, reporting mean/max/p95.
 * - UI: on a production build, time from goto until the first list row is visible, 3 samples.
 * Failures are surfaced as-is (non-zero exit code); slow samples are never deleted.
 */
const BASE = process.env.PERF_BASE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(BASE).hostname)) throw new Error("Only local measurements are allowed");
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
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie.includes("g42_session=")) throw new Error("No session cookie received");
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
    page.getByRole("button", { name: "Sign In", exact: true }).click(),
  ]);
  const samples = [];
  for (let index = 0; index < UI_SAMPLES; index++) {
    const started = performance.now();
    await page.goto(BASE + pathName, { waitUntil: "domcontentloaded" });
    await page.locator(waitSelector).first().waitFor({ state: "visible", timeout: 15000 });
    samples.push(performance.now() - started);
  }
  const result = { name, path: pathName, metric: "goto → first row/card visible", ...stats(samples) };
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
      api: `${SAMPLES} sequential requests per endpoint (after 3 warm-up requests), measuring the full HTTP round trip including reading the response body; same process, single-user cookie, local loopback.`,
      ui: `${UI_SAMPLES} production-build page navigations, measuring goto until the first list row / first stat card is visible; a single Chromium instance without cache clearing, not a first cold start.`,
      targets: { apiLocalP95: "≤ 2000ms", uiFirstContentP95: "≤ 3000ms" },
      caveat: "Local loopback measurements; not representative of public networks or high concurrency; no long-duration availability testing was performed.",
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
  console.log(`Targets met: API=${report.targetsMet.api} UI=${report.targetsMet.ui}`);
  if (!report.targetsMet.api || !report.targetsMet.ui) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
