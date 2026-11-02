import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

// The demo password is configurable; the default is for local demos only and is not a production secret.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Repeatable pseudo-random numbers (the same seed yields the same sequence) so every rebuild has an identical data shape. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function main() {
  if (process.env.RESET_DEMO_DATA !== "YES") {
    throw new Error("Refusing to wipe the database. Run seed only on a fresh/disposable demo database with RESET_DEMO_DATA=YES explicitly set.");
  }

  // Wipe the database (children before parents).
  await prisma.session.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const customerA = await prisma.user.create({
    data: { email: "customer.a@demo.com", name: "Demo Customer A", passwordHash, role: "CUSTOMER" },
  });
  const customerB = await prisma.user.create({
    data: { email: "customer.b@demo.com", name: "Demo Customer B", passwordHash, role: "CUSTOMER" },
  });
  const staff = await prisma.user.create({
    data: { email: "staff@demo.com", name: "Demo Staff", passwordHash, role: "STAFF" },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@demo.com", name: "Demo Administrator", passwordHash, role: "ADMIN" },
  });
  const customers = [customerA, customerB];

  const productSeed = [
    { sku: "SKU001", name: "Mineral Water 500ml", priceCents: 150, stock: 120, lowStockThreshold: 20 },
    { sku: "SKU002", name: "Cup Noodles", priceCents: 450, stock: 90, lowStockThreshold: 15 },
    { sku: "SKU003", name: "Face Masks, 50-Pack", priceCents: 2500, stock: 60, lowStockThreshold: 10 },
    { sku: "SKU004", name: "A4 Copy Paper", priceCents: 3000, stock: 45, lowStockThreshold: 5 },
    { sku: "SKU005", name: "Gel Pens, 12-Pack", priceCents: 1000, stock: 80, lowStockThreshold: 20 },
    { sku: "SKU006", name: "Notebook", priceCents: 1200, stock: 55, lowStockThreshold: 8 },
    // SKU007: stock 4 < threshold 5, always reserved for the "low-stock alert appears -> disappears after replenishment" demo.
    { sku: "SKU007", name: "Clear Tape", priceCents: 500, stock: 4, lowStockThreshold: 5 },
    { sku: "SKU008", name: "Medium Carton Box", priceCents: 800, stock: 70, lowStockThreshold: 10 },
    { sku: "SKU009", name: "AA Batteries", priceCents: 1200, stock: 65, lowStockThreshold: 10 },
    { sku: "SKU010", name: "Hand Sanitizer", priceCents: 1800, stock: 40, lowStockThreshold: 6 },
  ];
  for (const product of productSeed) {
    await prisma.product.create({ data: product });
  }
  const products = await prisma.product.findMany({ orderBy: { sku: "asc" } });
  const sellable = products.filter(product => product.sku !== "SKU007");

  /**
   * Order plan: the status distribution is fixed, dates spread over the last 12 days,
   * so the ADMIN 7-day report, pagination, status filters, and notifications all have real data.
   */
  const plan: { status: string; dayOffset: number; cancelledFrom?: "CREATED" | "CONFIRMED" }[] = [];
  const distribution: [string, number][] = [
    ["DELIVERED", 20], ["IN_TRANSIT", 6], ["SHIPPED", 8], ["PICKING", 4],
    ["CONFIRMED", 8], ["CREATED", 6], ["CANCELLED", 4],
  ];
  for (const [status, count] of distribution) {
    for (let index = 0; index < count; index++) plan.push({ status, dayOffset: index % 10 });
  }
  // Four cancelled orders: two from CREATED (no stock release), two from CONFIRMED (released once).
  plan[plan.length - 4].cancelledFrom = "CREATED";
  plan[plan.length - 3].cancelledFrom = "CREATED";
  plan[plan.length - 2].cancelledFrom = "CONFIRMED";
  plan[plan.length - 1].cancelledFrom = "CONFIRMED";

  const random = createRandom(20261030);
  const dayCounters = new Map<string, number>();
  const trackingCounters = new Map<string, number>();
  const now = new Date();
  let created = 0;

  for (let index = 0; index < plan.length; index++) {
    const entry = plan[index];
    // The longest chain is delivery at +28 hours; shift the whole history earlier so every completed event predates this run.
    const base = new Date(now.getTime() - 29 * 3600 * 1000 - entry.dayOffset * DAY_MS - (index % 7) * 3600 * 1000 - (index % 11) * 60 * 1000);
    const dayKey = utcDateKey(base);
    const sequence = (dayCounters.get(dayKey) ?? 0) + 1;
    dayCounters.set(dayKey, sequence);
    const orderNumber = `ORD-${dayKey}-${pad(sequence, 4)}`;
    const customer = customers[index % customers.length];

    // 1–2 item lines; prices are snapshots from order time.
    const lineCount = random() < 0.34 ? 2 : 1;
    const chosen: { productId: string; quantity: number; unitPriceCents: number }[] = [];
    for (let line = 0; line < lineCount; line++) {
      const product = sellable[(index * 3 + line * 5) % sellable.length];
      if (chosen.some(item => item.productId === product.id)) continue;
      chosen.push({ productId: product.id, quantity: 1 + Math.floor(random() * 3), unitPriceCents: product.priceCents });
    }
    const totalCents = chosen.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: "CREATED",
        totalCents,
        createdAt: base,
        updatedAt: base,
        items: { create: chosen.map(item => ({ ...item })) },
      },
    });
    created += 1;

    const stockSteps: string[] = [];
    const isConfirmedOrBeyond = !(entry.status === "CREATED" || entry.cancelledFrom === "CREATED");
    if (isConfirmedOrBeyond) {
      // Confirmation: real stock deduction + an ORDER_CONFIRM ledger entry.
      for (const item of chosen) {
        await prisma.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        await prisma.inventoryLog.create({
          data: {
            productId: item.productId, orderId: order.id, delta: -item.quantity,
            reason: "ORDER_CONFIRM", actorId: staff.id, createdAt: new Date(base.getTime() + 30 * 60 * 1000),
          },
        });
      }
      stockSteps.push("CONFIRMED");
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "ORDER_CONFIRMED",
          content: `Order ${orderNumber} confirmed (${formatHint(new Date(base.getTime() + 30 * 60 * 1000))})`,
          read: true, createdAt: new Date(base.getTime() + 30 * 60 * 1000),
        },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED", updatedAt: new Date(base.getTime() + 30 * 60 * 1000) } });
    }

    if (entry.cancelledFrom === "CONFIRMED" || entry.status === "CANCELLED") {
      if (entry.cancelledFrom === "CONFIRMED") {
        // Cancellation: one positive release ledger entry per SKU, released only once.
        for (const item of chosen) {
          await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          await prisma.inventoryLog.create({
            data: {
              productId: item.productId, orderId: order.id, delta: item.quantity,
              reason: "ORDER_CANCEL_RELEASE", actorId: staff.id, createdAt: new Date(base.getTime() + 90 * 60 * 1000),
            },
          });
        }
      }
      if (entry.cancelledFrom === "CREATED" || entry.cancelledFrom === "CONFIRMED") {
        const cancelledAt = new Date(base.getTime() + 90 * 60 * 1000);
        await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED", updatedAt: cancelledAt } });
        await prisma.notification.create({
          data: {
            userId: customer.id, orderId: order.id, type: "ORDER_CANCELLED",
            content: `Order ${orderNumber} cancelled (${formatHint(cancelledAt)})`,
            read: false, createdAt: cancelledAt,
          },
        });
        await prisma.order.update({ where: { id: order.id }, data: { updatedAt: cancelledAt } });
      }
    }

    const atStage = (stage: string) => stockSteps.includes("CONFIRMED") && stageRank(entry.status) >= stageRank(stage);

    if (atStage("PICKING")) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "PICKING", updatedAt: new Date(base.getTime() + 2 * 3600 * 1000) } });
    }

    if (atStage("SHIPPED")) {
      const shipAt = new Date(base.getTime() + 3 * 3600 * 1000);
      const trackingKey = utcDateKey(shipAt);
      const trackingSequence = (trackingCounters.get(trackingKey) ?? 0) + 1;
      trackingCounters.set(trackingKey, trackingSequence);
      const shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          trackingNumber: `LG-${trackingKey}-${pad(trackingSequence, 6)}`,
          carrier: index % 2 === 0 ? "SF Express" : "ZTO Express",
          status: "SHIPPED",
          shippedAt: shipAt,
        },
      });
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, at: shipAt, location: "Warehouse", description: `Shipped and handed over to ${shipment.carrier} (simulated logistics)` },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED", updatedAt: shipAt } });
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "SHIPMENT_SHIPPED",
          content: `Order ${orderNumber} shipped (${formatHint(shipAt)})`,
          read: index % 3 === 0, createdAt: shipAt,
        },
      });
    }

    if (atStage("IN_TRANSIT")) {
      const transitAt = new Date(base.getTime() + 8 * 3600 * 1000);
      const shipment = await prisma.shipment.findUniqueOrThrow({ where: { orderId: order.id } });
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, at: transitAt, location: "Pickup station", description: `Picked up by carrier ${shipment.carrier}` },
      });
      await prisma.shipment.update({ where: { orderId: order.id }, data: { status: "IN_TRANSIT" } });
      await prisma.order.update({ where: { id: order.id }, data: { status: "IN_TRANSIT", updatedAt: transitAt } });
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "SHIPMENT_IN_TRANSIT",
          content: `Order ${orderNumber} picked up (${formatHint(transitAt)})`,
          read: index % 2 === 0, createdAt: transitAt,
        },
      });
    }

    if (atStage("DELIVERED")) {
      const deliveredAt = new Date(base.getTime() + 28 * 3600 * 1000);
      const shipment = await prisma.shipment.findUniqueOrThrow({ where: { orderId: order.id } });
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, at: deliveredAt, location: "Delivery address", description: "Signed for by the recipient" },
      });
      await prisma.shipment.update({ where: { orderId: order.id }, data: { status: "DELIVERED", deliveredAt } });
      await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED", updatedAt: deliveredAt } });
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "SHIPMENT_DELIVERED",
          content: `Order ${orderNumber} delivered (${formatHint(deliveredAt)})`,
          read: index % 4 !== 0, createdAt: deliveredAt,
        },
      });
    }
  }

  const statusCounts = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const lowStock = (await prisma.product.findMany()).filter(product => product.stock < product.lowStockThreshold);
  const notifications = await prisma.notification.count();
  const logs = await prisma.inventoryLog.count();
  const shipments = await prisma.shipment.count();

  console.log("Demo data rebuilt (disposable database only)");
  console.log(`  Orders: ${created} — ` + statusCounts.map(row => `${row.status}=${row._count._all}`).join("  "));
  console.log(`  Shipments: ${shipments}; inventory ledger entries: ${logs}; notifications: ${notifications}`);
  console.log("  Low stock: " + (lowStock.length ? lowStock.map(p => `${p.sku}(${p.stock}/${p.lowStockThreshold})`).join(", ") : "none"));
  console.log("  Demo accounts (password from DEMO_PASSWORD, or Demo1234! when unset):");
  console.log("    customer.a@demo.com / customer.b@demo.com (customers)");
  console.log("    staff@demo.com (staff)  admin@demo.com (administrator, read-only reports)");
  void staff; void admin;
}

function stageRank(status: string): number {
  return ["CREATED", "CONFIRMED", "PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED"].indexOf(status);
}

/** Lightweight formatter with the same convention as lib/time.formatGmt8, so seed does not depend on path aliases. */
function formatHint(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 3600 * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${two(shifted.getUTCMonth() + 1)}-${two(shifted.getUTCDate())} ${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}:${two(shifted.getUTCSeconds())} GMT+8`;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
