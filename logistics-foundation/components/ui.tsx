import Link from "next/link";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { money } from "@/lib/catalog";
import type { PageQuery } from "@/lib/query-params";

const STATUS_CLASS: Record<string, string> = {
  CREATED: "created",
  CONFIRMED: "confirmed",
  PICKING: "picking",
  SHIPPED: "shipped",
  IN_TRANSIT: "transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

/** 状态必须“文字 + 颜色”双通道，不能只靠颜色区分。 */
export function StatusBadge({ status, testId }: { status: string; testId?: string }) {
  const label = STATUS_LABEL[status as OrderStatus] ?? status;
  return (
    <span className={`status ${STATUS_CLASS[status] ?? ""}`} data-status={status} data-testid={testId}>
      {label} / {status}
    </span>
  );
}

export function Money({ cents }: { cents: number }) {
  return <span className="mono">{money(cents)}</span>;
}

export function Forbidden({ detail }: { detail: string }) {
  return (
    <main className="page">
      <section className="card empty" role="alert">
        <strong>403 · 当前角色无权访问</strong>
        <p>{detail}</p>
        <p><Link className="button" href="/">返回首页</Link></p>
      </section>
    </main>
  );
}

/** 查询错误保留可编辑输入，不查询数据库，也不渲染误导性的列表结果。 */
export function InvalidQuery({ message, basePath, query, fields }: {
  message: string; basePath: string; query: PageQuery; fields: string[];
}) {
  const labels: Record<string, string> = { page: "页码", pageSize: "每页条数", status: "状态", orderNumber: "订单号", sku: "商品 SKU", logPage: "流水页码", logSku: "流水 SKU", lowStock: "只看低库存（0/1）", unread: "只看未读（0/1）", from: "起始日期 (GMT+8)", to: "结束日期 (GMT+8)" };
  return (
    <main className="page">
      <section className="card">
        <div className="card-body">
          <div className="feedback error" role="alert"><strong>查询参数有误</strong><p>{message}。请修改后重试。</p></div>
          <form className="filters" method="get" action={basePath}>
            {fields.map(name => (
              <div className="field" key={name}>
                <label htmlFor={name}>{labels[name] ?? name}</label>
                <input id={name} name={name} type={name === "from" || name === "to" ? "date" : "text"} defaultValue={Array.isArray(query[name]) ? query[name].join(", ") : query[name] ?? (["page", "logPage"].includes(name) ? "1" : name === "pageSize" ? (basePath === "/inventory" ? "20" : "10") : "")} />
              </div>
            ))}
            <button className="primary" type="submit">应用筛选</button>
            <Link className="button" href={basePath}>清除筛选</Link>
          </form>
        </div>
      </section>
    </main>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

interface PagerProps {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  pageParam?: string;
}

/** 分页导航：保留筛选条件，只改页码参数。 */
export function Pager({ basePath, params, page, totalPages, total, pageParam = "page" }: PagerProps) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set(pageParam, String(target));
    return `${basePath}?${search.toString()}`;
  };
  return (
    <nav className="pager" aria-label="分页">
      <span className="muted small">共 {total} 条 · 第 {page} / {totalPages} 页</span>
      <span className="pager-links">
        {page > 1 ? <Link className="button" href={href(page - 1)}>上一页</Link> : <span className="button disabled" aria-disabled="true">上一页</span>}
        {page < totalPages ? <Link className="button" href={href(page + 1)}>下一页</Link> : <span className="button disabled" aria-disabled="true">下一页</span>}
      </span>
    </nav>
  );
}

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "CREATED", label: "已创建" },
  { value: "CONFIRMED", label: "已确认" },
  { value: "PICKING", label: "拣货中" },
  { value: "SHIPPED", label: "已发货" },
  { value: "IN_TRANSIT", label: "在途" },
  { value: "DELIVERED", label: "已签收" },
  { value: "CANCELLED", label: "已取消" },
];
