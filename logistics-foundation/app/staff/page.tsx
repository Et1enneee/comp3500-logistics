import StaffConsole from "./staff-console";
export default async function StaffPage({ searchParams }: { searchParams: Promise<{ orderNumber?: string | string[] }> }) {
  const query = await searchParams;
  const initialNumber = typeof query.orderNumber === "string" ? query.orderNumber : "";
  return <main className="page"><div className="page-heading"><p className="eyebrow">STAFF / 订单履约</p><h1>查询一单，推动履约</h1><p className="subtitle">使用 ORD 订单号查询。确认、拣货、发货与物流更新由服务端校验，并在同一事务内更新库存、运单与事件。</p></div><StaffConsole initialNumber={initialNumber} /></main>;
}
