import Link from "next/link";
import { requirePageRole } from "@/lib/page-auth";
import { queryNotifications } from "@/lib/notifications-api";
import { prisma } from "@/lib/prisma";
import { EmptyState, Forbidden, InvalidQuery, Pager, StatusBadge } from "@/components/ui";
import { parseNotificationParams, parsePageQuery, type PageQuery } from "@/lib/query-params";
import { formatGmt8 } from "@/lib/time";
import MarkReadButton from "./mark-read-button";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ORDER_CONFIRMED: "Order Confirmed",
  ORDER_CANCELLED: "Order Cancelled",
  SHIPMENT_SHIPPED: "Shipped",
  SHIPMENT_IN_TRANSIT: "Picked Up",
  SHIPMENT_DELIVERED: "Delivered",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const session = await requirePageRole(["CUSTOMER"]);
  if (!session) return <Forbidden detail="The notification center is open to customers only." />;
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseNotificationParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/notifications" query={query} fields={["page", "pageSize", "unread"]} />;
  const { unreadOnly } = parsed.value;
  const result = await queryNotifications(prisma, session.user.id, parsed.value);

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER / In-app Notifications</p>
        <h1>Notification Center</h1>
        <p className="subtitle">Notifications are generated automatically by business transactions on confirmation, cancellation, shipping, pickup, and delivery; duplicate requests never notify twice. These are not emails or text messages.</p>
      </div>
      <section className="card">
        <div className="toolbar">
          <div className="inline-actions">
            <Link className="button" href="/notifications">All Notifications</Link>
            <Link className="button" href="/notifications?unread=1">Unread Only</Link>
          </div>
          <span className="small muted" data-testid="unread-count">{result.unreadCount} unread · {result.total} total</span>
        </div>
        {result.notifications.length === 0 ? (
          <EmptyState title={unreadOnly ? "No unread notifications" : "No notifications yet"}>
            Notifications appear here after staff confirm, ship, or cancel an order.
          </EmptyState>
        ) : (
          <ul className="list-plain" style={{ padding: "0 24px" }} data-testid="notification-list">
            {result.notifications.map(item => (
              <li key={item.id} className={item.read ? "read-row" : ""}>
                <span style={{ minWidth: 0 }}>
                  <span>
                    {!item.read && <span className="unread-dot" aria-label="Unread" />}
                    <strong>{TYPE_LABEL[item.type] ?? item.type}</strong>
                    <span className="tag" style={{ marginLeft: 8 }}>{item.type}</span>
                  </span>
                  <div className="small" style={{ marginTop: 4 }}>{item.content}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {formatGmt8(item.createdAt)} GMT+8
                    {item.orderNumber && <> · Order <span className="mono">{item.orderNumber}</span></>}
                    {item.orderStatus && <span style={{ marginLeft: 8 }}><StatusBadge status={item.orderStatus} /></span>}
                  </div>
                </span>
                <MarkReadButton id={item.id} csrfToken={session.csrfToken} read={item.read} />
              </li>
            ))}
          </ul>
        )}
        <Pager basePath="/notifications" params={{ pageSize: String(result.pageSize), unread: unreadOnly ? "1" : "" }} page={result.page} totalPages={result.totalPages} total={result.total} />
      </section>
    </main>
  );
}
