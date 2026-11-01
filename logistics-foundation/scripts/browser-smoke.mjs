import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";

if (process.env.FOUNDATION_BROWSER_TEST !== "YES") {
  throw new Error("仅在可丢弃、全新 seed 的本机演示库中测试。设置 FOUNDATION_BROWSER_TEST=YES 确认。");
}
const base = process.env.FOUNDATION_BASE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("只允许本机测试");

const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || "docs/evidence");
await fs.mkdir(evidenceDir, { recursive: true });

const db = new PrismaClient();
const passed = [];
const consoleErrors = [];
const startedAt = new Date().toISOString();

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true,
  args: ["--no-sandbox"],
});

async function makeUser(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const page = await context.newPage();
  page.on("pageerror", error => consoleErrors.push(`${email}: ${error.message}`));
  await page.goto(base + "/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 20000 }),
    page.getByRole("button", { name: "登录", exact: true }).click(),
  ]);
  return { context, page };
}

async function shot(page, name, options = {}) {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: options.fullPage ?? true });
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

const check = async (name, fn) => {
  await fn();
  passed.push(name);
  console.log("PASS " + name);
};

try {
  const customerA = await makeUser("customer.a@demo.com");
  const customerB = await makeUser("customer.b@demo.com");
  const staff = await makeUser("staff@demo.com");
  const admin = await makeUser("admin@demo.com");

  await check("closeout: invalid page parameters are recoverable across all list pages", async () => {
    const failures = [];
    const cases = [
      [customerA.page, "/orders?status=INVALID", "29-orders-invalid-status"],
      [staff.page, "/staff?status=INVALID", "30-staff-invalid-status"],
      [customerA.page, "/orders?page=1.5"], [staff.page, "/staff?page=1.5"],
      [staff.page, "/inventory?page=1.5", "31-inventory-invalid-page"],
      [staff.page, "/inventory?logPage=1.5"], [customerA.page, "/notifications?page=1.5"],
      [customerA.page, "/orders?page=1&page=2"], [staff.page, "/staff?status=CREATED&status=CONFIRMED"],
      [staff.page, "/inventory?sku=SKU001&sku=SKU002"],
      [customerA.page, "/notifications?unread=1&unread=0"],
      [admin.page, "/admin?from=2026-10-01&from=2026-10-02"],
    ];
    for (const [page, pathname, screenshot] of cases) {
      try {
        const response = await page.goto(base + pathname);
        assert.equal(response.status(), 200, pathname);
        await page.getByRole("alert").filter({ hasText: "查询参数有误" }).waitFor({ timeout: 1500 });
        assert.equal(await page.getByRole("button", { name: "应用筛选", exact: true }).count(), 1);
        if (screenshot) await shot(page, screenshot);
      } catch (error) { failures.push(`${pathname}: ${error.message}`); }
    }
    assert.deepEqual(failures, []);
    await customerA.page.locator('input[name="page"]').fill("1");
    await customerA.page.locator('input[name="unread"]').fill("0");
    await customerA.page.getByRole("button", { name: "应用筛选", exact: true }).click();
    await customerA.page.getByTestId("unread-count").waitFor();
    await customerA.page.goto(base + "/");
  });

  await check("closeout: malformed Cookie is expired for HTTP APIs and page navigation", async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      for (const value of ["%", "%ZZ", "%E0%A4%A"]) {
        const response = await page.request.get(base + "/api/v1/auth/me", { headers: { cookie: `g42_session=${value}` } });
        assert.equal(response.status(), 401);
        assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
        await context.addCookies([{ name: "g42_session", value, url: base }]);
        const navigation = await page.goto(base + "/orders");
        assert.equal(navigation.status(), 200);
        assert.equal(new URL(page.url()).pathname, "/login");
      }
      await shot(page, "32-malformed-cookie-login");
    } finally { await context.close(); }
  });

  await check("review regressions: invalid dates and logout failures recover", async () => {
    const failures = [];
    const attempt = async (name, fn) => {
      try { await fn(); } catch (error) { failures.push(`${name}: ${error.message}`); }
    };
    await attempt("inverted report dates", async () => {
      const page = admin.page;
      const response = await page.goto(`${base}/admin?from=2026-10-30&to=2026-10-01`);
      assert.equal(response.status(), 200, "invalid filter renders a usable page");
      await page.getByRole("alert").filter({ hasText: "起始日期不能晚于结束日期" }).waitFor({ timeout: 3000 });
      assert.equal(await page.locator("#from").inputValue(), "2026-10-30");
      assert.equal(await page.locator("#to").inputValue(), "2026-10-01");
      assert.equal(await page.getByTestId("stat-orders").count(), 0, "no misleading report for invalid input");
      await shot(page, "27-report-invalid-range");
      await page.locator("#from").fill("2026-10-01");
      await Promise.all([page.waitForURL(/from=2026-10-01/), page.getByRole("button", { name: "应用筛选" }).click()]);
      await page.getByTestId("stat-orders").waitFor();
    });
    await attempt("logout HTTP failure", async () => {
      const page = customerB.page;
      await page.goto(base + "/orders");
      await page.route("**/api/v1/auth/logout", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"服务暂不可用"}}' }));
      await page.getByRole("button", { name: "退出登录", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "退出失败" }).waitFor({ timeout: 3000 });
      assert.equal(await page.getByRole("button", { name: "退出登录", exact: true }).isEnabled(), true);
      assert.equal((await page.request.get(base + "/api/v1/auth/me")).status(), 200);
      await shot(page, "28-logout-service-error");
    });
    await customerB.page.unroute("**/api/v1/auth/logout");
    // Reload restores the old implementation after the first failing scenario as well.
    await customerB.page.goto(base + "/orders");
    await attempt("logout network failure", async () => {
      const page = customerB.page;
      await page.route("**/api/v1/auth/logout", route => route.abort("failed"));
      await page.getByRole("button", { name: "退出登录", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "退出失败" }).waitFor({ timeout: 3000 });
      assert.equal(await page.getByRole("button", { name: "退出登录", exact: true }).isEnabled(), true);
      assert.equal((await page.request.get(base + "/api/v1/auth/me")).status(), 200);
    });
    await customerB.page.unroute("**/api/v1/auth/logout");
    assert.deepEqual(failures, []);
  });

  let orderId = "";
  let orderNumber = "";

  await check("customer A login lands on catalog with DB stock and role chip", async () => {
    const page = customerA.page;
    await page.getByRole("heading", { name: "从一张订单开始" }).waitFor();
    assert.match(await page.getByTestId("stock-SKU001").textContent(), /^\d+/);
    assert.ok((await page.locator(".identity").innerText()).includes("客户"));
    assert.ok((await page.locator(".identity").innerText()).includes("customer.a@demo.com"));
    await shot(page, "01-customer-catalog");
  });

  await check("customer A creates an order: CREATED, stock unchanged, no ledger row", async () => {
    const page = customerA.page;
    const skuBefore = (await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock;
    await page.getByLabel("SKU002 数量").fill("2");
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/v1/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "提交订单", exact: true }).click();
    const response = await waiting;
    assert.equal(response.status(), 201);
    await page.getByTestId("created-order-number").waitFor();
    orderNumber = (await page.getByTestId("created-order-number").textContent()).trim();
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber } });
    orderId = order.id;
    assert.equal(order.status, "CREATED");
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, skuBefore);
    assert.equal(await db.inventoryLog.count({ where: { orderId } }), 0);
    await shot(page, "02-order-created");
  });

  await check("customer order detail shows empty-shipment state (no stack trace)", async () => {
    const page = customerA.page;
    await page.getByRole("link", { name: "查看订单详情 →" }).click();
    await page.waitForURL(`**/orders/${orderId}`);
    assert.ok((await page.locator("main").innerText()).includes("尚未发货"));
    assert.equal(await page.getByTestId("tracking-number").count(), 0);
    await shot(page, "03-customer-detail-empty");
  });

  await check("customer B cannot read A's order by direct URL or by ORD", async () => {
    const page = customerB.page;
    await page.goto(`${base}/orders/${orderId}`);
    assert.ok((await page.locator("main").innerText()).includes("404"));
    const api = await page.request.get(`${base}/api/v1/orders/${orderId}`);
    assert.equal(api.status(), 404);
    const byNumber = await page.request.get(`${base}/api/v1/orders?orderNumber=${orderNumber}`);
    assert.equal(byNumber.status(), 404);
    await page.goto(`${base}/orders?orderNumber=${orderNumber}`);
    assert.ok((await page.locator("main").innerText()).includes("未找到该订单"));
    await shot(page, "04-customer-b-not-found");
  });

  await check("staff queue lists >50 orders with status filter and pagination", async () => {
    const page = staff.page;
    await page.goto(base + "/staff");
    await page.getByRole("heading", { name: "订单工作台" }).waitFor();
    const totalText = await page.locator(".toolbar .small.muted").last().textContent();
    assert.match(totalText, /共 \d+ 张订单/);
    assert.ok(Number(totalText.match(/共 (\d+) 张/)[1]) >= 50);
    await page.locator("#status-filter").selectOption("CREATED");
    await page.getByRole("button", { name: "筛选" }).click();
    await page.waitForURL(/status=CREATED/);
    assert.ok((await page.locator("tbody tr").first().innerText()).includes("已创建"));
    await shot(page, "05-staff-queue");
    // 用 ORD 精确查询回到刚创建的订单
    await page.locator("#order-number").fill(orderNumber);
    await page.getByRole("button", { name: "查询订单" }).click();
    await page.getByRole("link", { name: "打开订单详情 →" }).click();
    await page.waitForURL(`**/staff/orders/${orderId}`);
  });

  await check("staff confirm reserves stock once and shows server-read state", async () => {
    const page = staff.page;
    const before = (await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock;
    await page.getByRole("button", { name: "确认订单", exact: true }).click();
    await page.getByRole("alertdialog", { name: "确认占用库存" }).waitFor({ timeout: 3000 });
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, "CREATED");
    await page.getByRole("button", { name: "返回", exact: true }).click();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before);
    await page.getByRole("button", { name: "确认订单", exact: true }).click();
    await page.getByRole("button", { name: "确认扣减库存", exact: true }).click();
    await page.getByTestId("order-status").filter({ hasText: "CONFIRMED" }).waitFor();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before - 2);
    const logs = await db.inventoryLog.findMany({ where: { orderId, reason: "ORDER_CONFIRM" } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].delta, -2);
    assert.equal((await db.notification.count({ where: { orderId, type: "ORDER_CONFIRMED" } })), 1);
    await shot(page, "06-staff-confirmed");
  });

  await check("staff pick → ship generates unique LG waybill, stock not touched again", async () => {
    const page = staff.page;
    await page.getByRole("button", { name: "开始拣货" }).click();
    await page.getByTestId("order-status").filter({ hasText: "PICKING" }).waitFor();
    const before = (await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock;
    await page.locator("#carrier").fill("顺丰速运");
    await page.getByRole("button", { name: "发货并生成运单" }).click();
    await page.getByTestId("tracking-number").waitFor();
    assert.match((await page.getByTestId("tracking-number").textContent()).trim(), /^LG-\d{8}-\d{6}$/);
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before);
    assert.equal(await db.shipment.count({ where: { orderId } }), 1);
    await shot(page, "07-staff-shipped");
  });

  await check("tracking read failure after a successful transit does not report a false failure", async () => {
    const page = staff.page;
    await page.route("**/api/v1/orders/*/tracking", route =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "注入的追踪故障" } }) }),
    );
    await page.getByRole("button", { name: "模拟揽收" }).click();
    await page.getByTestId("order-status").filter({ hasText: "IN_TRANSIT" }).waitFor();
    await page.locator(".feedback.error").filter({ hasText: "追踪" }).first().waitFor();
    const alerts = await page.locator('[role="alert"]').allTextContents();
    assert.ok(!alerts.some(text => text.includes("结果未知") || text.includes("操作失败")), JSON.stringify(alerts));
    await page.unroute("**/api/v1/orders/*/tracking");
    await shot(page, "08-tracking-warning");
  });

  await check("staff delivers; customer A sees delivered status + 3 ordered events", async () => {
    await staff.page.getByRole("button", { name: "模拟签收" }).click();
    await staff.page.getByTestId("order-status").filter({ hasText: "DELIVERED" }).waitFor();
    const events = await db.trackingEvent.findMany({ where: { shipment: { orderId } }, orderBy: { at: "asc" } });
    assert.equal(events.length, 3);
    assert.deepEqual(events.map(event => event.location), ["仓库", "揽收网点", "收件地址"]);

    const page = customerA.page;
    await page.goto(`${base}/orders/${orderId}`);
    await page.getByTestId("tracking-number").waitFor();
    assert.ok((await page.getByTestId("order-status").first().textContent()).includes("已签收"));
    const timeline = await page.getByTestId("tracking-timeline").locator("li").allTextContents();
    assert.equal(timeline.length, 3);
    assert.ok(timeline[0].includes("仓库") && timeline[2].includes("收件地址"));
    await shot(page, "09-customer-tracking");
  });

  await check("customer notification center shows unread count and marks one read", async () => {
    const page = customerA.page;
    await page.goto(base + "/notifications");
    await page.getByTestId("notification-list").waitFor();
    const before = await db.notification.count({ where: { userId: (await db.user.findUniqueOrThrow({ where: { email: "customer.a@demo.com" } })).id, read: false } });
    assert.ok(before >= 4, `expected >=4 unread, got ${before}`);
    await page.getByRole("button", { name: "标记已读" }).first().click();
    await page.waitForFunction(
      expected => Number(document.querySelector('[data-testid="unread-count"]').textContent.match(/未读 (\d+) 条/)[1]) < expected,
      before,
      { timeout: 10000 },
    );
    await shot(page, "10-notifications");
  });

  await check("admin dashboard matches database aggregates and exports CSV", async () => {
    const page = admin.page;
    await page.goto(base + "/admin");
    await page.getByRole("heading", { name: "订单与库存概览" }).waitFor();
    const rangeText = await page.getByTestId("report-range").textContent();
    assert.ok(rangeText.includes("GMT+8"));
    const now = new Date();
    const shifted = new Date(now.getTime() + 8 * 3600 * 1000);
    const today = shifted.toISOString().slice(0, 10);
    const from = new Date(shifted.getTime() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const startUtc = new Date(Date.parse(from + "T00:00:00.000Z") - 8 * 3600 * 1000);
    const endUtc = new Date(Date.parse(today + "T00:00:00.000Z") - 8 * 3600 * 1000 + 24 * 3600 * 1000);
    const orders = await db.order.findMany({ where: { createdAt: { gte: startUtc, lt: endUtc } } });
    const deliveredSum = orders.filter(order => order.status === "DELIVERED").reduce((sum, order) => sum + order.totalCents, 0);
    const statCount = Number((await page.getByTestId("stat-orders").innerText()).match(/\d+/)[0]);
    assert.equal(statCount, orders.length);
    const deliveredText = await page.getByTestId("stat-delivered-amount").innerText();
    assert.ok(deliveredText.includes((deliveredSum / 100).toFixed(2)), deliveredText);
    await shot(page, "11-admin-dashboard");

    const csv = await page.request.get(`${base}/api/v1/reports/export.csv?from=${from}&to=${today}`);
    assert.equal(csv.status(), 200);
    const body = await csv.text();
    assert.ok(body.includes("orderNumber,createdAtGmt8,timezone,status,statusLabel,totalCents,totalYuan"));
    assert.ok(body.includes(orderNumber));
  });

  await check("role boundaries: admin is read-only, customer/staff see forbidden page content", async () => {
    const adminPage = admin.page;
    await adminPage.goto(base + "/inventory");
    await adminPage.getByRole("heading", { name: "库存工作台" }).waitFor();
    assert.equal(await adminPage.getByRole("button", { name: "补货" }).count(), 0);
    await shot(adminPage, "12-admin-inventory-readonly");

    await customerA.page.goto(base + "/admin");
    assert.ok((await customerA.page.locator("main").innerText()).includes("403"));
    await staff.page.goto(base + "/admin");
    assert.ok((await staff.page.locator("main").innerText()).includes("403"));
    await shot(customerA.page, "13-forbidden");
  });

  await check("unauthorised direct API calls return 401/403 with stable error shape", async () => {
    const anonymous = await browser.newContext();
    const anonPage = await anonymous.newPage();
    const noSession = await anonPage.request.patch(`${base}/api/v1/orders/${orderId}/status`, { data: { to: "CONFIRMED" } });
    assert.equal(noSession.status(), 401);
    assert.equal((await noSession.json()).error.code, "UNAUTHENTICATED");
    const customerConfirm = await customerA.page.request.patch(`${base}/api/v1/orders/${orderId}/status`, {
      headers: { "X-CSRF-Token": await csrfOf(customerA.page), "Content-Type": "application/json" },
      data: { to: "CONFIRMED" },
    });
    assert.equal(customerConfirm.status(), 403);
    assert.equal((await customerConfirm.json()).error.code, "FORBIDDEN");
    const noCsrf = await staff.page.request.post(`${base}/api/v1/shipments`, { data: { orderNumber, carrier: "顺丰" } });
    assert.equal(noCsrf.status(), 403);
    assert.equal((await noCsrf.json()).error.code, "CSRF_INVALID");
    const reportsForStaff = await staff.page.request.get(`${base}/api/v1/reports/overview`);
    assert.equal(reportsForStaff.status(), 403);
    await anonymous.close();
  });

  let cancelOrderId = "";
  let cancelOrderNumber = "";
  await check("cancel chain: confirm SKU007 order then cancel restores stock exactly once", async () => {
    const page = customerA.page;
    await page.goto(base + "/");
    await page.getByLabel("SKU007 数量").fill("2");
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/v1/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "提交订单", exact: true }).click();
    assert.equal((await waiting).status(), 201);
    await page.getByTestId("created-order-number").waitFor();
    cancelOrderNumber = (await page.getByTestId("created-order-number").textContent()).trim();
    const created = await db.order.findUniqueOrThrow({ where: { orderNumber: cancelOrderNumber } });
    cancelOrderId = created.id;

    const stockBefore = (await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock;
    await staff.page.goto(`${base}/staff/orders/${cancelOrderId}`);
    await staff.page.getByRole("button", { name: "确认订单", exact: true }).click();
    await staff.page.getByRole("button", { name: "确认扣减库存", exact: true }).click();
    await staff.page.getByTestId("order-status").filter({ hasText: "CONFIRMED" }).waitFor();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock, stockBefore - 2);
    await shot(staff.page, "14-cancel-before");

    await page.goto(`${base}/orders/${cancelOrderId}`);
    await page.getByRole("button", { name: "取消订单", exact: true }).click();
    await page.getByRole("button", { name: "确认取消", exact: true }).click();
    await page.getByTestId("order-status").filter({ hasText: "CANCELLED" }).waitFor();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock, stockBefore);
    assert.equal(await db.inventoryLog.count({ where: { orderId: cancelOrderId, reason: "ORDER_CANCEL_RELEASE" } }), 1);
    await shot(page, "15-cancel-after");

    // 重复取消：接口 409，库存不再变化
    const repeat = await page.request.patch(`${base}/api/v1/orders/${cancelOrderId}/status`, {
      headers: { "X-CSRF-Token": await csrfOf(page), "Content-Type": "application/json" },
      data: { to: "CANCELLED" },
    });
    assert.equal(repeat.status(), 409);
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock, stockBefore);
  });

  await check("low stock warning disappears after staff replenishes 4→5, ledger records operator", async () => {
    const page = staff.page;
    await page.goto(base + "/inventory");
    await page.getByTestId("low-stock-list").waitFor();
    await page.getByTestId("low-stock-SKU007").waitFor();
    const beforeStock = (await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock;
    await shot(page, "16-low-stock");
    await page.getByTestId("low-stock-SKU007").getByLabel(/补货数量/).fill("1");
    await page.getByTestId("low-stock-SKU007").getByRole("button", { name: "补货" }).click();
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="low-stock-card"] .card-head .small.muted').textContent.match(/(\d+)/)[1]) === 0,
      undefined,
      { timeout: 15000 },
    );
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock, beforeStock + 1);
    const replenishLog = await db.inventoryLog.findFirstOrThrow({ where: { productId: (await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).id, reason: "STOCK_REPLENISH" }, orderBy: { createdAt: "desc" } });
    assert.equal(replenishLog.delta, 1);
    assert.ok(replenishLog.actorId);
    await shot(page, "17-low-stock-cleared");
  });

  await check("replenishment ledger page shows delta/reason/order/operator", async () => {
    const page = staff.page;
    await page.goto(base + "/inventory");
    await page.getByTestId("inventory-logs").waitFor();
    const text = await page.getByTestId("inventory-logs").innerText();
    assert.ok(text.includes("STOCK_REPLENISH"));
    assert.ok(text.includes("ORDER_CANCEL_RELEASE"));
    assert.ok(text.includes("staff@demo.com"));
    await shot(page, "18-inventory-logs");
  });

  await check("network unknown on a write shows unknown state and recovers after refresh", async () => {
    const page = customerA.page;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/");
    await page.getByLabel("SKU005 数量").fill("1");
    const upstream = page.waitForResponse(response => response.url().endsWith("/api/v1/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "提交订单", exact: true }).click();
    assert.equal((await upstream).status(), 201);
    await page.getByTestId("created-order-number").waitFor();
    const number = (await page.getByTestId("created-order-number").textContent()).trim();
    const created = await db.order.findUniqueOrThrow({ where: { orderNumber: number } });

    await staff.page.goto(`${base}/staff/orders/${created.id}`);
    await staff.page.route("**/api/v1/orders/*/status", route => route.abort("failed"));
    await staff.page.getByRole("button", { name: "确认订单", exact: true }).click();
    await staff.page.getByRole("button", { name: "确认扣减库存", exact: true }).click();
    await staff.page.locator(".feedback.info").filter({ hasText: "结果未知" }).waitFor();
    const successText = await staff.page.locator(".feedback.success").allTextContents();
    assert.ok(!successText.some(text => text.includes("已确认")), JSON.stringify(successText));
    await staff.page.unroute("**/api/v1/orders/*/status");

    // 服务器恢复后重新加载即可看到真实状态（未被前端假成功污染）。
    await staff.page.reload();
    await staff.page.getByRole("button", { name: "确认订单", exact: true }).click();
    await staff.page.getByRole("button", { name: "确认扣减库存", exact: true }).click();
    await staff.page.getByTestId("order-status").filter({ hasText: "CONFIRMED" }).waitFor();
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status, "CONFIRMED");
    await shot(staff.page, "26-network-unknown-recovered");
  });

  await check("out-of-stock create shows readable error and writes nothing", async () => {
    const page = customerA.page;
    await page.goto(base + "/");
    const count = await db.order.count();
    await page.getByLabel("SKU007 数量").fill("9999");
    await page.getByRole("button", { name: "提交订单", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "可用库存" }).waitFor();
    assert.equal(await db.order.count(), count);
    await shot(page, "19-insufficient-stock");
  });

  await check("mobile 390: customer, staff and admin pages have no horizontal overflow", async () => {
    const page = customerA.page;
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [pathname, screenshot] of [["/", "20-mobile-customer"], ["/orders", "21-mobile-orders"], ["/notifications", "22-mobile-notifications"]]) {
      await page.goto(base + pathname);
      await page.waitForLoadState("networkidle");
      assert.ok(await noOverflow(page), `${pathname} overflows on mobile`);
      await shot(page, screenshot);
    }
    await staff.page.setViewportSize({ width: 390, height: 844 });
    await staff.page.goto(base + "/staff");
    await staff.page.waitForLoadState("networkidle");
    assert.ok(await noOverflow(staff.page), "/staff overflows on mobile");
    await shot(staff.page, "23-mobile-staff");
    await admin.page.setViewportSize({ width: 390, height: 844 });
    await admin.page.goto(base + "/admin");
    await admin.page.waitForLoadState("networkidle");
    assert.ok(await noOverflow(admin.page), "/admin overflows on mobile");
    await shot(admin.page, "24-mobile-admin");
  });

  await check("dark scheme remains usable", async () => {
    const page = customerA.page;
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(base + "/");
    await page.getByRole("heading", { name: "从一张订单开始" }).waitFor();
    assert.ok(await noOverflow(page));
    await shot(page, "25-mobile-dark");
    await page.emulateMedia({ colorScheme: "light" });
  });

  await check("logout kills the session immediately", async () => {
    const page = customerB.page;
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL("**/login");
    await page.goto(base + "/orders");
    await page.waitForURL(/\/login/, { timeout: 10000 });
    assert.ok(page.url().includes("/login"));
  });

  assert.deepEqual(consoleErrors, []);
  await fs.writeFile(
    path.join(evidenceDir, "browser-results.json"),
    JSON.stringify({
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl: base,
      passed,
      passedCount: passed.length,
      consoleErrors,
      orderNumber,
      orderId,
      cancelOrderNumber,
      cancelOrderId,
    }, null, 2),
  );
  console.log(`Browser acceptance passed: ${passed.length} checks`);
} catch (error) {
  await fs.writeFile(
    path.join(evidenceDir, "browser-results.json"),
    JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), passed, passedCount: passed.length, consoleErrors, error: String(error?.stack || error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await db.$disconnect();
}

/** 从页面 /api/v1/auth/me 读取 CSRF 令牌（页面本身不暴露 token 到 localStorage）。 */
async function csrfOf(page) {
  const response = await page.request.get(base + "/api/v1/auth/me");
  assert.equal(response.status(), 200);
  return (await response.json()).csrfToken;
}
