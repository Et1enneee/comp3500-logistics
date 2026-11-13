import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createTestDatabase, createUsers } from "./harness";
import { verifyPassword } from "../lib/auth";

test("Demo driver creation is opt-in and never resets existing accounts or orders", { timeout: 180000 }, async () => {
  const { db, dispose, url } = await createTestDatabase("driver-demo");
  try {
    const users = await createUsers(db);
    const order = await db.order.create({ data: { orderNumber: "ORD-PRESERVE-1", customerId: users.customerA.id, totalCents: 0 } });
    const run = (enabled: string) => spawnSync(process.execPath, ["--import", "tsx", "scripts/create-demo-driver.ts"], {
      env: { ...process.env, DATABASE_URL_OVERRIDE: url, CREATE_DEMO_DRIVER: enabled, DEMO_PASSWORD: "CustomDemo123!" }, encoding: "utf8", timeout: 30000,
    });
    assert.notEqual(run("").status, 0);
    assert.equal(await db.user.count(), 4);
    assert.equal(run("YES").status, 0);
    const driver = await db.user.findUniqueOrThrow({ where: { email: "driver@demo.com" } });
    assert.equal(driver.role, "DRIVER");
    assert.ok(verifyPassword("CustomDemo123!", driver.passwordHash));
    assert.equal(run("YES").status, 0);
    const unchanged = await db.user.findUniqueOrThrow({ where: { email: driver.email } });
    assert.equal(unchanged.id, driver.id);
    assert.equal(unchanged.passwordHash, driver.passwordHash);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).customerId, users.customerA.id);
    await db.user.update({ where: { id: driver.id }, data: { role: "CUSTOMER" } });
    assert.notEqual(run("YES").status, 0);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: driver.id } })).role, "CUSTOMER");
  } finally { await dispose(); }
});
