import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { createAuthHandlers } from "../lib/auth-api";

/**
 * Migration data-preservation verification (P0-F):
 * 1) Apply only the first v0.3.1 migration, then insert "legacy database" users/orders/inventory/ledger/notifications;
 * 2) Add the v0.4.0 migration and deploy again;
 * 3) Assert every legacy row survives, the new tables/columns are in place, and historical rows get no fabricated operator;
 * 4) The legacy demo hash fails real login; after upgrading it with the reset-demo-passwords tool it works, and the order is still there.
 */

const require = createRequire(resolve("package.json"));
const prismaCli = require.resolve("prisma/build/index.js");
const tsxCli = require.resolve("tsx/cli");
const legacyMigration = "20261013114356_init";
const newMigration = "20261030120000_auth_inventory_notifications";
const driverMigration = "20261102110000_driver_assignment";
const addressMigration = "20261102120000_delivery_address";
const checks: { name: string; detail: unknown }[] = [];

function record(name: string, detail: unknown) {
  checks.push({ name, detail });
  console.log(`PASS ${name}`);
}

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "g42-migration-"));
  const dbUrl = "file:" + join(directory, "legacy.db").replaceAll("\\", "/");
  try {
    const prismaDir = join(directory, "prisma");
    await mkdir(join(prismaDir, "migrations"), { recursive: true });
    const schemaSource = await readFile(resolve("prisma/schema.prisma"), "utf8");
    const schema = schemaSource.replace(/url\s*=\s*"file:\.\/dev\.db"/, 'url = env("ORDER_TEST_DATABASE_URL")');
    if (schema === schemaSource) throw new Error("Failed to replace the schema datasource; refusing to continue");
    await writeFile(join(prismaDir, "schema.prisma"), schema);
    await cp(resolve("prisma/migrations", legacyMigration), join(prismaDir, "migrations", legacyMigration), { recursive: true });
    await writeFile(
      join(prismaDir, "migrations", "migration_lock.toml"),
      await readFile(resolve("prisma/migrations", "migration_lock.toml")),
    );

    const deploy = () => execFileSync(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")],
      { env: { ...process.env, ORDER_TEST_DATABASE_URL: dbUrl, RUST_LOG: "info" }, stdio: "pipe", timeout: 60000 },
    );
    deploy();
    record("legacy database created with v0.3.1 schema only", { migration: legacyMigration });

    const legacy = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await legacy.$connect();
    const customer = await legacy.user.create({
      data: { email: "customer.a@demo.com", name: "Legacy Customer", passwordHash: "demo", role: "CUSTOMER" },
    });
    await legacy.user.create({ data: { email: "staff@demo.com", name: "Legacy Staff", passwordHash: "demo", role: "STAFF" } });
    const product = await legacy.product.create({
      data: { sku: "SKU001", name: "Mineral Water 500ml", priceCents: 150, stock: 97, lowStockThreshold: 20 },
    });
    const order = await legacy.order.create({
      data: {
        orderNumber: "ORD-20261001-0001", customerId: customer.id, status: "CONFIRMED", totalCents: 450,
        items: { create: [{ productId: product.id, quantity: 3, unitPriceCents: 150 }] },
      },
      select: { id: true },
    });
    // Preserve a real legacy shipment across the later optional driver-assignment migration.
    await legacy.shipment.createMany({ data: [{ orderId: order.id, trackingNumber: "LG-LEGACY-1", carrier: "Legacy", status: "SHIPPED" }] });
    // The legacy schema lacks the new columns: use createMany so Prisma does not read back v0.4-only columns.
    await legacy.inventoryLog.createMany({
      data: [{ productId: product.id, orderId: order.id, delta: -3, reason: "ORDER_CONFIRM" }],
    });
    await legacy.notification.createMany({
      data: [{ userId: customer.id, type: "LEGACY_NOTE", content: "Legacy notification" }],
    });
    await legacy.$disconnect();

    await cp(resolve("prisma/migrations", newMigration), join(prismaDir, "migrations", newMigration), { recursive: true });
    deploy();
    record("v0.4.0 migration applied on top of existing data", { migration: newMigration });

    await cp(resolve("prisma/migrations", driverMigration), join(prismaDir, "migrations", driverMigration), { recursive: true });
    deploy();
    record("driver assignment migration applied without resetting existing data", { migration: driverMigration });

    await cp(resolve("prisma/migrations", addressMigration), join(prismaDir, "migrations", addressMigration), { recursive: true });
    deploy();
    record("delivery address migration applied without inventing legacy addresses", { migration: addressMigration });

    const migrated = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await migrated.$connect();
    const ordersAfter = await migrated.order.count();
    const itemsAfter = await migrated.orderItem.count();
    const logsAfter = await migrated.inventoryLog.count();
    const productsAfter = await migrated.product.count();
    const notificationsAfter = await migrated.notification.count();
    const legacyLog = await migrated.inventoryLog.findFirstOrThrow({ where: { reason: "ORDER_CONFIRM" } });
    const legacyNote = await migrated.notification.findFirstOrThrow({ where: { type: "LEGACY_NOTE" } });
    const legacyOrder = await migrated.order.findUniqueOrThrow({ where: { orderNumber: "ORD-20261001-0001" } });
    const legacyShipment = await migrated.shipment.findUniqueOrThrow({ where: { trackingNumber: "LG-LEGACY-1" } });
    if (legacyOrder.deliveryAddress !== null) throw new Error("Legacy order must not be assigned a fabricated address");
    if (legacyShipment.driverId !== null || legacyShipment.orderId !== legacyOrder.id) throw new Error("Legacy shipment or empty assignment not preserved");
    if (ordersAfter !== 1 || itemsAfter !== 1 || logsAfter !== 1 || productsAfter !== 1 || notificationsAfter !== 1) {
      throw new Error(`Legacy row counts mismatch: orders=${ordersAfter} items=${itemsAfter} logs=${logsAfter} products=${productsAfter} notifications=${notificationsAfter}`);
    }
    if (legacyOrder.status !== "CONFIRMED" || legacyOrder.totalCents !== 450) throw new Error("Legacy order fields were changed");
    if (legacyLog.actorId !== null) throw new Error("The new actorId column must be null, not a fabricated operator");
    if (legacyNote.orderId !== null) throw new Error("The legacy notification must not be bound to an order");
    record("existing orders, stock, ledger and notifications preserved", {
      orders: ordersAfter, items: itemsAfter, logs: logsAfter, products: productsAfter, notifications: notificationsAfter,
    });

    const tables = await migrated.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
    const tableNames = tables.map(row => row.name);
    for (const table of ["Session", "Notification", "InventoryLog"]) {
      if (!tableNames.includes(table)) throw new Error(`Missing table ${table}`);
    }
    const sessionColumns = await migrated.$queryRaw<{ name: string }[]>`PRAGMA table_info("Session")`;
    const columnNames = sessionColumns.map(row => row.name);
    for (const column of ["tokenHash", "csrfToken", "expiresAt"]) {
      if (!columnNames.includes(column)) throw new Error(`Session is missing column ${column}`);
    }
    record("new tables and columns exist after migration", { tables: tableNames.filter(name => ["Session", "Notification", "InventoryLog"].includes(name)) });

    const auth = createAuthHandlers(migrated);
    const loginRequest = () => new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "customer.a@demo.com", password: "Demo1234!" }),
    });
    const beforeReset = await auth.login(loginRequest());
    if (beforeReset.status !== 401) throw new Error(`The legacy demo hash must not be able to log in, got ${beforeReset.status}`);
    record("legacy demo password hash is rejected by real login", { status: beforeReset.status });

    execFileSync(process.execPath, [tsxCli, resolve("scripts/reset-demo-passwords.ts")], {
      env: { ...process.env, RESET_PASSWORDS: "YES", DEMO_PASSWORD: "Demo1234!", DATABASE_URL_OVERRIDE: dbUrl, RUST_LOG: "info" },
      stdio: "pipe",
      timeout: 120000,
    });
    const afterReset = await auth.login(loginRequest());
    if (afterReset.status !== 200) throw new Error(`Login should succeed after the password reset, got ${afterReset.status}`);
    const ordersStillThere = await migrated.order.count();
    if (ordersStillThere !== 1) throw new Error("The password reset must not delete orders");
    record("reset-passwords tool upgrades hash without deleting data", {
      loginStatus: afterReset.status, ordersAfterReset: ordersStillThere,
    });
    await migrated.$disconnect();

    const reportPath = process.env.MIGRATION_REPORT || "docs/evidence/migration-check.json";
    await mkdir(resolve(reportPath, ".."), { recursive: true });
    await writeFile(
      resolve(reportPath),
      JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), checks }, null, 2),
    );
    console.log("Migration data-preservation verification passed");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
