import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, cp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createTestDatabase } from "./harness";

test("demo seed timestamps are ordered and never in the future", { timeout: 180000 }, async () => {
  const { db, dispose, url } = await createTestDatabase("seed-time");
  const directory = await mkdtemp(join(tmpdir(), "seed-source-"));
  try {
    // Run the actual seed against the test client's isolated datasource.
    await cp("prisma/seed.ts", join(directory, "seed.ts"));
    const source = await readFile(join(directory, "seed.ts"), "utf8");
    await writeFile(join(directory, "seed.ts"), source
      .replace('from "@prisma/client"', `from ${JSON.stringify(resolve("node_modules/@prisma/client/default.js"))}`)
      .replace('from "../lib/auth"', `from ${JSON.stringify(resolve("lib/auth.ts"))}`)
      .replace("new PrismaClient()", `new PrismaClient({ datasources: { db: { url: ${JSON.stringify(url)} } } })`));
    const before = new Date();
    execFileSync(process.execPath, ["--import", "tsx", join(directory, "seed.ts")], {
      env: { ...process.env, RESET_DEMO_DATA: "YES" }, stdio: "pipe", timeout: 60000,
    });
    const orders = await db.order.findMany({ include: { shipment: { include: { events: { orderBy: { at: "asc" } } } }, notifications: true } });
    assert.equal(orders.length, 56);
    for (const order of orders) {
      assert.ok(order.createdAt <= order.updatedAt, order.orderNumber);
      assert.ok(order.updatedAt <= before, `${order.orderNumber}: future status timestamp`);
      let previous = order.createdAt;
      for (const event of order.shipment?.events ?? []) {
        assert.ok(event.at >= previous && event.at <= before, `${order.orderNumber}: event chronology`);
        previous = event.at;
      }
      for (const notification of order.notifications) assert.ok(notification.createdAt >= order.createdAt && notification.createdAt <= before);
    }
    for (const log of await db.inventoryLog.findMany()) assert.ok(log.createdAt <= before, "future inventory log");
  } finally {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
