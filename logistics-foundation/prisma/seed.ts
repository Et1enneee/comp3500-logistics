import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

// 演示口令可配置；默认值只用于本地演示，不是生产 secret。
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const DAY_MS = 24 * 60 * 60 * 1000;

/** 可重复的伪随机数（同一 seed 同一序列），保证每次重建数据形状一致。 */
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
    throw new Error("拒绝清空数据库。仅在全新/可丢弃演示库，明确设置 RESET_DEMO_DATA=YES 后执行 seed。");
  }

  // 清库（先子后父）。
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
    data: { email: "customer.a@demo.com", name: "演示客户 A", passwordHash, role: "CUSTOMER" },
  });
  const customerB = await prisma.user.create({
    data: { email: "customer.b@demo.com", name: "演示客户 B", passwordHash, role: "CUSTOMER" },
  });
  const staff = await prisma.user.create({
    data: { email: "staff@demo.com", name: "演示员工", passwordHash, role: "STAFF" },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@demo.com", name: "演示管理员", passwordHash, role: "ADMIN" },
  });
  const customers = [customerA, customerB];

  const productSeed = [
    { sku: "SKU001", name: "矿泉水 500ml", priceCents: 150, stock: 120, lowStockThreshold: 20 },
    { sku: "SKU002", name: "杯面", priceCents: 450, stock: 90, lowStockThreshold: 15 },
    { sku: "SKU003", name: "口罩 50 只装", priceCents: 2500, stock: 60, lowStockThreshold: 10 },
    { sku: "SKU004", name: "A4 打印纸", priceCents: 3000, stock: 45, lowStockThreshold: 5 },
    { sku: "SKU005", name: "签字笔 12 支", priceCents: 1000, stock: 80, lowStockThreshold: 20 },
    { sku: "SKU006", name: "笔记本", priceCents: 1200, stock: 55, lowStockThreshold: 8 },
    // SKU007：库存 4 < 阈值 5，永远保留给“库存预警出现 → 补货后消失”演示。
    { sku: "SKU007", name: "透明胶带", priceCents: 500, stock: 4, lowStockThreshold: 5 },
    { sku: "SKU008", name: "中号纸箱", priceCents: 800, stock: 70, lowStockThreshold: 10 },
    { sku: "SKU009", name: "5 号电池", priceCents: 1200, stock: 65, lowStockThreshold: 10 },
    { sku: "SKU010", name: "洗手液", priceCents: 1800, stock: 40, lowStockThreshold: 6 },
  ];
  for (const product of productSeed) {
    await prisma.product.create({ data: product });
  }
  const products = await prisma.product.findMany({ orderBy: { sku: "asc" } });
  const sellable = products.filter(product => product.sku !== "SKU007");

  /**
   * 订单计划：状态分布固定，日期分布在最近 12 天内，
   * 保证 ADMIN 近 7 天报表、分页、状态筛选和通知都有真实数据。
   */
  const plan: { status: string; dayOffset: number; cancelledFrom?: "CREATED" | "CONFIRMED" }[] = [];
  const distribution: [string, number][] = [
    ["DELIVERED", 20], ["IN_TRANSIT", 6], ["SHIPPED", 8], ["PICKING", 4],
    ["CONFIRMED", 8], ["CREATED", 6], ["CANCELLED", 4],
  ];
  for (const [status, count] of distribution) {
    for (let index = 0; index < count; index++) plan.push({ status, dayOffset: index % 10 });
  }
  // 四张取消单：两张来自 CREATED（不回补），两张来自 CONFIRMED（回补一次）。
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
    // 最长链为签收 +28 小时；将整个历史链前移，所有已完成事件均早于本次生成。
    const base = new Date(now.getTime() - 29 * 3600 * 1000 - entry.dayOffset * DAY_MS - (index % 7) * 3600 * 1000 - (index % 11) * 60 * 1000);
    const dayKey = utcDateKey(base);
    const sequence = (dayCounters.get(dayKey) ?? 0) + 1;
    dayCounters.set(dayKey, sequence);
    const orderNumber = `ORD-${dayKey}-${pad(sequence, 4)}`;
    const customer = customers[index % customers.length];

    // 1–2 条明细，价格取下单时快照。
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
      // 确认：真实扣库存 + ORDER_CONFIRM 流水。
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
          content: `订单 ${orderNumber} 已确认（${formatHint(new Date(base.getTime() + 30 * 60 * 1000))}）`,
          read: true, createdAt: new Date(base.getTime() + 30 * 60 * 1000),
        },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED", updatedAt: new Date(base.getTime() + 30 * 60 * 1000) } });
    }

    if (entry.cancelledFrom === "CONFIRMED" || entry.status === "CANCELLED") {
      if (entry.cancelledFrom === "CONFIRMED") {
        // 取消：每 SKU 一条正释放流水，只回补一次。
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
            content: `订单 ${orderNumber} 已取消（${formatHint(cancelledAt)}）`,
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
          carrier: index % 2 === 0 ? "顺丰速运" : "中通快递",
          status: "SHIPPED",
          shippedAt: shipAt,
        },
      });
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, at: shipAt, location: "仓库", description: `已发货，交由 ${shipment.carrier} 承运（模拟物流）` },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED", updatedAt: shipAt } });
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "SHIPMENT_SHIPPED",
          content: `订单 ${orderNumber} 已发货（${formatHint(shipAt)}）`,
          read: index % 3 === 0, createdAt: shipAt,
        },
      });
    }

    if (atStage("IN_TRANSIT")) {
      const transitAt = new Date(base.getTime() + 8 * 3600 * 1000);
      const shipment = await prisma.shipment.findUniqueOrThrow({ where: { orderId: order.id } });
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, at: transitAt, location: "揽收网点", description: `承运商 ${shipment.carrier} 已揽收` },
      });
      await prisma.shipment.update({ where: { orderId: order.id }, data: { status: "IN_TRANSIT" } });
      await prisma.order.update({ where: { id: order.id }, data: { status: "IN_TRANSIT", updatedAt: transitAt } });
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "SHIPMENT_IN_TRANSIT",
          content: `订单 ${orderNumber} 已揽收（${formatHint(transitAt)}）`,
          read: index % 2 === 0, createdAt: transitAt,
        },
      });
    }

    if (atStage("DELIVERED")) {
      const deliveredAt = new Date(base.getTime() + 28 * 3600 * 1000);
      const shipment = await prisma.shipment.findUniqueOrThrow({ where: { orderId: order.id } });
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, at: deliveredAt, location: "收件地址", description: "收件人已签收" },
      });
      await prisma.shipment.update({ where: { orderId: order.id }, data: { status: "DELIVERED", deliveredAt } });
      await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED", updatedAt: deliveredAt } });
      await prisma.notification.create({
        data: {
          userId: customer.id, orderId: order.id, type: "SHIPMENT_DELIVERED",
          content: `订单 ${orderNumber} 已签收（${formatHint(deliveredAt)}）`,
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

  console.log("演示数据已重建（仅限可丢弃库）");
  console.log(`  订单 ${created} 张：` + statusCounts.map(row => `${row.status}=${row._count._all}`).join("  "));
  console.log(`  运单 ${shipments} 张，库存流水 ${logs} 条，站内通知 ${notifications} 条`);
  console.log("  低库存：" + (lowStock.length ? lowStock.map(p => `${p.sku}(${p.stock}/${p.lowStockThreshold})`).join("、") : "无"));
  console.log("  演示账号（密码取 DEMO_PASSWORD，未设置时为 Demo1234!）：");
  console.log("    customer.a@demo.com / customer.b@demo.com（客户）");
  console.log("    staff@demo.com（员工）  admin@demo.com（管理员，只读报表）");
  void staff; void admin;
}

function stageRank(status: string): number {
  return ["CREATED", "CONFIRMED", "PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED"].indexOf(status);
}

/** 与 lib/time.formatGmt8 相同口径的轻量格式化，避免 seed 依赖别名路径。 */
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
