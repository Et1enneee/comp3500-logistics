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

/** Status must be conveyed on two channels — "text + color" — never color alone. */
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
        <strong>403 · Your role cannot access this page</strong>
        <p>{detail}</p>
        <p><Link className="button" href="/">Back to Home</Link></p>
      </section>
    </main>
  );
}

/** Query errors keep the inputs editable, skip the database query, and never render misleading list results. */
export function InvalidQuery({ message, basePath, query, fields }: {
  message: string; basePath: string; query: PageQuery; fields: string[];
}) {
  const labels: Record<string, string> = { page: "Page", pageSize: "Page size", status: "Status", orderNumber: "Order number", sku: "Product SKU", logPage: "Ledger page", logSku: "Ledger SKU", lowStock: "Low stock only (0/1)", unread: "Unread only (0/1)", from: "From date (GMT+8)", to: "To date (GMT+8)" };
  return (
    <main className="page">
      <section className="card">
        <div className="card-body">
          <div className="feedback error" role="alert"><strong>Invalid query parameters</strong><p>{message}. Please correct them and try again.</p></div>
          <form className="filters" method="get" action={basePath}>
            {fields.map(name => (
              <div className="field" key={name}>
                <label htmlFor={name}>{labels[name] ?? name}</label>
                <input id={name} name={name} type={name === "from" || name === "to" ? "date" : "text"} defaultValue={Array.isArray(query[name]) ? query[name].join(", ") : query[name] ?? (["page", "logPage"].includes(name) ? "1" : name === "pageSize" ? (basePath === "/inventory" ? "20" : "10") : "")} />
              </div>
            ))}
            <button className="primary" type="submit">Apply Filters</button>
            <Link className="button" href={basePath}>Clear Filters</Link>
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

/** Pagination navigation: keeps the filter conditions and changes only the page parameter. */
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
    <nav className="pager" aria-label="Pagination">
      <span className="muted small">{total} items · Page {page} of {totalPages}</span>
      <span className="pager-links">
        {page > 1 ? <Link className="button" href={href(page - 1)}>Previous</Link> : <span className="button disabled" aria-disabled="true">Previous</span>}
        {page < totalPages ? <Link className="button" href={href(page + 1)}>Next</Link> : <span className="button disabled" aria-disabled="true">Next</span>}
      </span>
    </nav>
  );
}

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "CREATED", label: "Created" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PICKING", label: "Picking" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];
