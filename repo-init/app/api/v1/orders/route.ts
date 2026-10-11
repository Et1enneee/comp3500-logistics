// POST /api/v1/orders —— 已写完，不用补；GET 一起给了
import { prisma } from "@/lib/prisma";

function err(code: string, status = 400) {
  return Response.json({ error: { code, message: code } }, { status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const email: string = body.email;
  const items: { sku: string; quantity: number }[] = body.items;

  const customer = await prisma.user.findUnique({ where: { email } });
  if (!customer) return err("CUSTOMER_NOT_FOUND");

  let totalCents = 0;
  const lines: { productId: string; quantity: number; unitPriceCents: number }[] = [];
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (!product) return err("SKU_NOT_FOUND_" + item.sku);
    if (product.stock < item.quantity) return err("INSUFFICIENT_STOCK_" + item.sku);
    totalCents += product.priceCents * item.quantity;
    lines.push({ productId: product.id, quantity: item.quantity, unitPriceCents: product.priceCents });
  }

  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const count = await prisma.order.count({ where: { orderNumber: { startsWith: "ORD-" + today } } });
  const orderNumber = "ORD-" + today + "-" + String(count + 1).padStart(4, "0");

  const order = await prisma.order.create({
    data: { orderNumber, customerId: customer.id, totalCents, status: "CREATED", items: { create: lines } },
    include: { items: true },
  });

  return Response.json({ order }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderNumber = url.searchParams.get("orderNumber") ?? "";
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, customer: true },
  });
  if (!order) return err("ORDER_NOT_FOUND", 404);
  return Response.json({ order });
}
