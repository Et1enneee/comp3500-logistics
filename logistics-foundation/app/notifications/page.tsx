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
  ORDER_CONFIRMED: "订单已确认",
  ORDER_CANCELLED: "订单已取消",
  SHIPMENT_SHIPPED: "已发货",
  SHIPMENT_IN_TRANSIT: "已揽收",
  SHIPMENT_DELIVERED: "已签收",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const session = await requirePageRole(["CUSTOMER"]);
  if (!session) return <Forbidden detail="通知中心仅对客户开放。" />;
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseNotificationParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/notifications" query={query} fields={["page", "pageSize", "unread"]} />;
  const { unreadOnly } = parsed.value;
  const result = await queryNotifications(prisma, session.user.id, parsed.value);

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER / 站内通知</p>
        <h1>通知中心</h1>
        <p className="subtitle">确认、取消、发货、揽收、签收时由业务事务自动生成；重复请求不会重复通知。这里不是邮件或短信。</p>
      </div>
      <section className="card">
        <div className="toolbar">
          <div className="inline-actions">
            <Link className="button" href="/notifications">全部通知</Link>
            <Link className="button" href="/notifications?unread=1">只看未读</Link>
          </div>
          <span className="small muted" data-testid="unread-count">未读 {result.unreadCount} 条 · 共 {result.total} 条</span>
        </div>
        {result.notifications.length === 0 ? (
          <EmptyState title={unreadOnly ? "没有未读通知" : "还没有通知"}>
            员工确认、发货或取消订单后，相关通知会出现在这里。
          </EmptyState>
        ) : (
          <ul className="list-plain" style={{ padding: "0 24px" }} data-testid="notification-list">
            {result.notifications.map(item => (
              <li key={item.id} className={item.read ? "read-row" : ""}>
                <span style={{ minWidth: 0 }}>
                  <span>
                    {!item.read && <span className="unread-dot" aria-label="未读" />}
                    <strong>{TYPE_LABEL[item.type] ?? item.type}</strong>
                    <span className="tag" style={{ marginLeft: 8 }}>{item.type}</span>
                  </span>
                  <div className="small" style={{ marginTop: 4 }}>{item.content}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {formatGmt8(item.createdAt)} GMT+8
                    {item.orderNumber && <> · 订单 <span className="mono">{item.orderNumber}</span></>}
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
