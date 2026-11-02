import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";

if (process.env.FOUNDATION_BROWSER_TEST !== "YES") {
  throw new Error("Run only against a disposable, freshly seeded local demo database. Set FOUNDATION_BROWSER_TEST=YES to confirm.");
}
const base = process.env.FOUNDATION_BASE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Only local testing is allowed");

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
    page.getByRole("button", { name: "Sign In", exact: true }).click(),
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
        await page.getByRole("alert").filter({ hasText: "Invalid query parameters" }).waitFor({ timeout: 1500 });
        assert.equal(await page.getByRole("button", { name: "Apply Filters", exact: true }).count(), 1);
        if (screenshot) await shot(page, screenshot);
      } catch (error) { failures.push(`${pathname}: ${error.message}`); }
    }
    assert.deepEqual(failures, []);
    await customerA.page.locator('input[name="page"]').fill("1");
    await customerA.page.locator('input[name="unread"]').fill("0");
    await customerA.page.getByRole("button", { name: "Apply Filters", exact: true }).click();
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
      await page.getByRole("alert").filter({ hasText: "The from date cannot be after the to date" }).waitFor({ timeout: 3000 });
      assert.equal(await page.locator("#from").inputValue(), "2026-10-30");
      assert.equal(await page.locator("#to").inputValue(), "2026-10-01");
      assert.equal(await page.getByTestId("stat-orders").count(), 0, "no misleading report for invalid input");
      await shot(page, "27-report-invalid-range");
      await page.locator("#from").fill("2026-10-01");
      await Promise.all([page.waitForURL(/from=2026-10-01/), page.getByRole("button", { name: "Apply Filters" }).click()]);
      await page.getByTestId("stat-orders").waitFor();
    });
    await attempt("logout HTTP failure", async () => {
      const page = customerB.page;
      await page.goto(base + "/orders");
      await page.route("**/api/v1/auth/logout", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"Service temporarily unavailable"}}' }));
      await page.getByRole("button", { name: "Sign Out", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Sign-out failed" }).waitFor({ timeout: 3000 });
      assert.equal(await page.getByRole("button", { name: "Sign Out", exact: true }).isEnabled(), true);
      assert.equal((await page.request.get(base + "/api/v1/auth/me")).status(), 200);
      await shot(page, "28-logout-service-error");
    });
    await customerB.page.unroute("**/api/v1/auth/logout");
    // Reload restores the old implementation after the first failing scenario as well.
    await customerB.page.goto(base + "/orders");
    await attempt("logout network failure", async () => {
      const page = customerB.page;
      await page.route("**/api/v1/auth/logout", route => route.abort("failed"));
      await page.getByRole("button", { name: "Sign Out", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Sign-out failed" }).waitFor({ timeout: 3000 });
      assert.equal(await page.getByRole("button", { name: "Sign Out", exact: true }).isEnabled(), true);
      assert.equal((await page.request.get(base + "/api/v1/auth/me")).status(), 200);
    });
    await customerB.page.unroute("**/api/v1/auth/logout");
    assert.deepEqual(failures, []);
  });

  let orderId = "";
  let orderNumber = "";

  await check("customer A login lands on catalog with DB stock and role chip", async () => {
    const page = customerA.page;
    await page.getByRole("heading", { name: "Start with an Order" }).waitFor();
    assert.match(await page.getByTestId("stock-SKU001").textContent(), /^\d+/);
    assert.ok((await page.locator(".identity").innerText()).includes("Customer"));
    assert.ok((await page.locator(".identity").innerText()).includes("customer.a@demo.com"));
    await shot(page, "01-customer-catalog");
  });

  await check("staff assigns a shipped order and driver completes simulated delivery", async () => {
    const seeded = await db.shipment.findFirstOrThrow({ where: { driverId: null, order: { status: "SHIPPED" } }, include: { order: true } });
    const driver = await makeUser("driver@demo.com");
    try {
      await staff.page.goto(`${base}/staff/orders/${seeded.orderId}`);
      assert.ok(seeded.order.deliveryAddress, "Seeded demonstration address is required");
      assert.equal((await staff.page.content()).includes(seeded.order.deliveryAddress), false, "Staff page exposed the delivery address");
      const driverRow = await db.user.findUniqueOrThrow({ where: { email: "driver@demo.com" } });
      await staff.page.locator("#driver-select").selectOption(driverRow.id);
      await staff.page.getByRole("button", { name: "Assign Driver" }).click();
      await staff.page.getByRole("status").filter({ hasText: "Driver assigned" }).waitFor();
      assert.equal((await db.shipment.findUniqueOrThrow({ where: { id: seeded.id } })).driverId, driverRow.id);
      await driver.page.goto(base + "/driver");
      await driver.page.getByRole("heading", { name: "My Deliveries" }).waitFor();
      const card = driver.page.locator("section.card").filter({ hasText: seeded.order.orderNumber });
      assert.ok((await card.innerText()).includes(seeded.order.deliveryAddress), "Assigned driver must see the delivery address");
      await card.getByRole("button", { name: "Simulate Pickup" }).click();
      await card.getByRole("button", { name: "Simulate Delivery" }).waitFor();
      await card.getByRole("button", { name: "Simulate Delivery" }).click();
      await card.getByText("Completed", { exact: true }).waitFor();
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: seeded.orderId } })).status, "DELIVERED");
      const html = await driver.page.content();
      for (const value of ["Demo Customer A", "customer.a@demo.com", "Demo Customer B", "customer.b@demo.com"]) assert.equal(html.includes(value), false);
      await shot(driver.page, "34-driver-delivery");
      await driver.page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await noOverflow(driver.page), "Driver page should fit a mobile viewport");
      await shot(driver.page, "35-driver-mobile");
    } finally { await driver.context.close(); }
  });

  await check("customer A creates an order: CREATED, stock unchanged, no ledger row", async () => {
    const page = customerA.page;
    const skuBefore = (await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock;
    await page.getByLabel("SKU002 quantity").fill("2");
    const beforeCount = await db.order.count();
    await page.getByRole("button", { name: "Place Order", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Please enter a delivery address" }).waitFor();
    assert.equal(await db.order.count(), beforeCount);
    await page.getByLabel("Delivery address").fill("Browser Demo Address, Example Street");
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/v1/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Place Order", exact: true }).click();
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
    await page.getByRole("link", { name: "View Order Details →" }).click();
    await page.waitForURL(`**/orders/${orderId}`);
    assert.ok((await page.locator("main").innerText()).includes("Not shipped yet"));
    assert.ok((await page.locator("main").innerText()).includes("Browser Demo Address, Example Street"));
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
    assert.ok((await page.locator("main").innerText()).includes("Order not found"));
    await shot(page, "04-customer-b-not-found");
  });

  await check("staff queue lists >50 orders with status filter and pagination", async () => {
    const page = staff.page;
    await page.goto(base + "/staff");
    await page.getByRole("heading", { name: "Order Workbench" }).waitFor();
    for (const value of ["Demo Customer A", "customer.a@demo.com", "Demo Customer B", "customer.b@demo.com"]) {
      assert.equal((await page.content()).includes(value), false, `Staff queue exposed ${value}`);
    }
    const totalText = await page.locator(".toolbar .small.muted").last().textContent();
    assert.match(totalText, /\d+ orders total/);
    assert.ok(Number(totalText.match(/(\d+) orders total/)[1]) >= 50);
    await page.locator("#status-filter").selectOption("CREATED");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.waitForURL(/status=CREATED/);
    assert.ok((await page.locator("tbody tr").first().innerText()).includes("Created"));
    await shot(page, "05-staff-queue");
    // Use the ORD number to find the order just created
    await page.locator("#order-number").fill(orderNumber);
    await page.getByRole("button", { name: "Find Order" }).click();
    await page.getByRole("link", { name: "Open Order Details →" }).click();
    await page.waitForURL(`**/staff/orders/${orderId}`);
    for (const value of ["Demo Customer A", "customer.a@demo.com", "Demo Customer B", "customer.b@demo.com"]) {
      assert.equal((await page.content()).includes(value), false, `Staff detail exposed ${value}`);
    }
  });

  await check("staff confirm reserves stock once and shows server-read state", async () => {
    const page = staff.page;
    const before = (await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock;
    await page.getByRole("button", { name: "Confirm Order", exact: true }).click();
    await page.getByRole("alertdialog", { name: "Confirm stock reservation" }).waitFor({ timeout: 3000 });
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, "CREATED");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before);
    await page.getByRole("button", { name: "Confirm Order", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Stock Deduction", exact: true }).click();
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
    await page.getByRole("button", { name: "Start Picking" }).click();
    await page.getByTestId("order-status").filter({ hasText: "PICKING" }).waitFor();
    const before = (await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock;
    await page.locator("#carrier").fill("SF Express");
    await page.getByRole("button", { name: "Ship Order" }).click();
    await page.getByTestId("tracking-number").waitFor();
    assert.match((await page.getByTestId("tracking-number").textContent()).trim(), /^LG-\d{8}-\d{6}$/);
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU002" } })).stock, before);
    assert.equal(await db.shipment.count({ where: { orderId } }), 1);
    await shot(page, "07-staff-shipped");
  });

  await check("tracking read failure after a successful transit does not report a false failure", async () => {
    const page = staff.page;
    await page.route("**/api/v1/orders/*/tracking", route =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Injected tracking failure" } }) }),
    );
    await page.getByRole("button", { name: "Simulate Pickup" }).click();
    await page.getByTestId("order-status").filter({ hasText: "IN_TRANSIT" }).waitFor();
    await page.locator(".feedback.error").filter({ hasText: "Failed to load shipment tracking" }).first().waitFor();
    const alerts = await page.locator('[role="alert"]').allTextContents();
    assert.ok(!alerts.some(text => text.includes("is unknown") || text.includes("Operation failed")), JSON.stringify(alerts));
    await page.unroute("**/api/v1/orders/*/tracking");
    await shot(page, "08-tracking-warning");
  });

  await check("staff delivers; customer A sees delivered status + 3 ordered events", async () => {
    await staff.page.getByRole("button", { name: "Simulate Delivery" }).click();
    await staff.page.getByTestId("order-status").filter({ hasText: "DELIVERED" }).waitFor();
    const events = await db.trackingEvent.findMany({ where: { shipment: { orderId } }, orderBy: { at: "asc" } });
    assert.equal(events.length, 3);
    assert.deepEqual(events.map(event => event.location), ["Warehouse", "Pickup station", "Delivery address"]);

    const page = customerA.page;
    await page.goto(`${base}/orders/${orderId}`);
    await page.getByTestId("tracking-number").waitFor();
    assert.ok((await page.getByTestId("order-status").first().textContent()).includes("Delivered"));
    const timeline = await page.getByTestId("tracking-timeline").locator("li").allTextContents();
    assert.equal(timeline.length, 3);
    assert.ok(timeline[0].includes("Warehouse") && timeline[2].includes("Delivery address"));
    await shot(page, "09-customer-tracking");
  });

  await check("customer notification center shows unread count and marks one read", async () => {
    const page = customerA.page;
    await page.goto(base + "/notifications");
    await page.getByTestId("notification-list").waitFor();
    const before = await db.notification.count({ where: { userId: (await db.user.findUniqueOrThrow({ where: { email: "customer.a@demo.com" } })).id, read: false } });
    assert.ok(before >= 4, `expected >=4 unread, got ${before}`);
    await page.getByRole("button", { name: "Mark as Read" }).first().click();
    await page.waitForFunction(
      expected => Number(document.querySelector('[data-testid="unread-count"]').textContent.match(/(\d+) unread/)[1]) < expected,
      before,
      { timeout: 10000 },
    );
    await shot(page, "10-notifications");
  });

  await check("admin dashboard matches database aggregates and exports CSV", async () => {
    const page = admin.page;
    await page.goto(base + "/admin");
    await page.getByRole("heading", { name: "Orders & Inventory Overview" }).waitFor();
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
    await adminPage.getByRole("heading", { name: "Inventory Workbench" }).waitFor();
    assert.equal(await adminPage.getByRole("button", { name: "Replenish" }).count(), 0);
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
    const noCsrf = await staff.page.request.post(`${base}/api/v1/shipments`, { data: { orderNumber, carrier: "SF Express" } });
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
    await page.getByLabel("Delivery address").fill("Browser Demo Address, Example Street");
    await page.getByLabel("SKU007 quantity").fill("2");
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/v1/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Place Order", exact: true }).click();
    assert.equal((await waiting).status(), 201);
    await page.getByTestId("created-order-number").waitFor();
    cancelOrderNumber = (await page.getByTestId("created-order-number").textContent()).trim();
    const created = await db.order.findUniqueOrThrow({ where: { orderNumber: cancelOrderNumber } });
    cancelOrderId = created.id;

    const stockBefore = (await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock;
    await staff.page.goto(`${base}/staff/orders/${cancelOrderId}`);
    await staff.page.getByRole("button", { name: "Confirm Order", exact: true }).click();
    await staff.page.getByRole("button", { name: "Confirm Stock Deduction", exact: true }).click();
    await staff.page.getByTestId("order-status").filter({ hasText: "CONFIRMED" }).waitFor();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock, stockBefore - 2);
    await shot(staff.page, "14-cancel-before");

    await page.goto(`${base}/orders/${cancelOrderId}`);
    await page.getByRole("button", { name: "Cancel Order", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Cancellation", exact: true }).click();
    await page.getByTestId("order-status").filter({ hasText: "CANCELLED" }).waitFor();
    assert.equal((await db.product.findUniqueOrThrow({ where: { sku: "SKU007" } })).stock, stockBefore);
    assert.equal(await db.inventoryLog.count({ where: { orderId: cancelOrderId, reason: "ORDER_CANCEL_RELEASE" } }), 1);
    await shot(page, "15-cancel-after");

    // Repeated cancellation: the API returns 409 and the stock no longer changes
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
    await page.getByTestId("low-stock-SKU007").getByLabel(/replenishment quantity/).fill("1");
    await page.getByTestId("low-stock-SKU007").getByRole("button", { name: "Replenish" }).click();
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
    await page.getByLabel("Delivery address").fill("Browser Demo Address, Example Street");
    await page.getByLabel("SKU005 quantity").fill("1");
    const upstream = page.waitForResponse(response => response.url().endsWith("/api/v1/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Place Order", exact: true }).click();
    assert.equal((await upstream).status(), 201);
    await page.getByTestId("created-order-number").waitFor();
    const number = (await page.getByTestId("created-order-number").textContent()).trim();
    const created = await db.order.findUniqueOrThrow({ where: { orderNumber: number } });

    await staff.page.goto(`${base}/staff/orders/${created.id}`);
    await staff.page.route("**/api/v1/orders/*/status", route => route.abort("failed"));
    await staff.page.getByRole("button", { name: "Confirm Order", exact: true }).click();
    await staff.page.getByRole("button", { name: "Confirm Stock Deduction", exact: true }).click();
    await staff.page.locator(".feedback.info").filter({ hasText: "result of the operation is unknown" }).waitFor();
    const successText = await staff.page.locator(".feedback.success").allTextContents();
    assert.ok(!successText.some(text => text.includes("Confirmed")), JSON.stringify(successText));
    await staff.page.unroute("**/api/v1/orders/*/status");

    // After the server recovers, a reload shows the real state (not contaminated by a false front-end success).
    await staff.page.reload();
    await staff.page.getByRole("button", { name: "Confirm Order", exact: true }).click();
    await staff.page.getByRole("button", { name: "Confirm Stock Deduction", exact: true }).click();
    await staff.page.getByTestId("order-status").filter({ hasText: "CONFIRMED" }).waitFor();
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status, "CONFIRMED");
    await shot(staff.page, "26-network-unknown-recovered");
  });

  await check("out-of-stock create shows readable error and writes nothing", async () => {
    const page = customerA.page;
    await page.goto(base + "/");
    const count = await db.order.count();
    await page.getByLabel("Delivery address").fill("Browser Demo Address, Example Street");
    await page.getByLabel("SKU007 quantity").fill("9999");
    await page.getByRole("button", { name: "Place Order", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "available stock" }).waitFor();
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
    await page.getByRole("heading", { name: "Start with an Order" }).waitFor();
    assert.ok(await noOverflow(page));
    await shot(page, "25-mobile-dark");
    await page.emulateMedia({ colorScheme: "light" });
  });

  await check("logout kills the session immediately", async () => {
    const page = customerB.page;
    await page.getByRole("button", { name: "Sign Out" }).click();
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

/** Read the CSRF token from the page's /api/v1/auth/me (the page itself never exposes the token to localStorage). */
async function csrfOf(page) {
  const response = await page.request.get(base + "/api/v1/auth/me");
  assert.equal(response.status(), 200);
  return (await response.json()).csrfToken;
}
