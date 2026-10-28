import { prisma } from "@/lib/prisma";
import OrderForm from "./order-form";
export const dynamic = "force-dynamic";
export default async function Home() {
  const products = await prisma.product.findMany({ orderBy: { sku: "asc" }, select: { sku: true, name: true, priceCents: true, stock: true, lowStockThreshold: true } });
  return <main className="page"><div className="page-heading"><p className="eyebrow">CUSTOMER / 创建订单</p><h1>从一张订单开始</h1><p className="subtitle">选择商品与数量。提交只创建订单；员工确认后预占库存，拣货发货并生成运单，可查看追踪。</p><div className="step-row" aria-label="本阶段业务流程"><span className="active">01 选择商品并下单</span><span>02 员工查询订单</span><span>03 确认并预占库存</span><span>04 拣货并发货</span><span>05 追踪与签收</span></div></div><OrderForm products={products} /></main>;
}
