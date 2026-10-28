import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.RESET_DEMO_DATA !== "YES") throw new Error("拒绝清空数据库。仅在全新/可丢弃演示库，明确设置 RESET_DEMO_DATA=YES 后执行 seed。");
  // 清库（顺序：先子后父）
  await prisma.inventoryLog.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { email: "customer@demo.com", name: "演示客户", passwordHash: "demo", role: "CUSTOMER" },
      { email: "staff@demo.com", name: "演示员工", passwordHash: "demo", role: "STAFF" },
      { email: "admin@demo.com", name: "演示管理员", passwordHash: "demo", role: "ADMIN" },
    ],
  });

  await prisma.product.createMany({
    data: [
      { sku: "SKU001", name: "矿泉水 500ml", priceCents: 150, stock: 100, lowStockThreshold: 20 },
      { sku: "SKU002", name: "杯面", priceCents: 450, stock: 60, lowStockThreshold: 15 },
      { sku: "SKU003", name: "口罩 50 只装", priceCents: 2500, stock: 40, lowStockThreshold: 10 },
      { sku: "SKU004", name: "A4 打印纸", priceCents: 3000, stock: 25, lowStockThreshold: 5 },
      { sku: "SKU005", name: "签字笔 12 支", priceCents: 1000, stock: 80, lowStockThreshold: 20 },
      { sku: "SKU006", name: "笔记本", priceCents: 1200, stock: 30, lowStockThreshold: 8 },
      // SKU007 库存 4 < 阈值 5：专门留给「库存预警」演示
      { sku: "SKU007", name: "透明胶带", priceCents: 500, stock: 4, lowStockThreshold: 5 },
      { sku: "SKU008", name: "中号纸箱", priceCents: 800, stock: 50, lowStockThreshold: 10 },
      { sku: "SKU009", name: "5 号电池", priceCents: 1200, stock: 45, lowStockThreshold: 10 },
      { sku: "SKU010", name: "洗手液", priceCents: 1800, stock: 12, lowStockThreshold: 6 },
    ],
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
