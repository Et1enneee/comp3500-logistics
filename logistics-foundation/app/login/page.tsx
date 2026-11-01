import { redirect } from "next/navigation";
import { getPageSession, homePathForRole } from "@/lib/page-auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const session = await getPageSession();
  if (session) redirect(homePathForRole(session.user.role));
  const query = await searchParams;
  const nextPath = typeof query.next === "string" ? query.next : "";
  return (
    <main className="page">
      <div className="login-shell">
        <div className="page-heading">
          <p className="eyebrow">登录</p>
          <h1>进入物流工作台</h1>
          <p className="subtitle">客户下单与自助追踪；员工履约与库存；管理员只读运营报表。身份与权限全部由服务端会话判定。</p>
        </div>
        <section className="card login-card">
          <div className="card-body">
            <LoginForm nextPath={nextPath} />
            <div className="login-help">
              <strong>本地演示账号</strong>
              <ul>
                <li>customer.a@demo.com · 演示客户 A</li>
                <li>customer.b@demo.com · 演示客户 B</li>
                <li>staff@demo.com · 演示员工</li>
                <li>admin@demo.com · 演示管理员（只读）</li>
              </ul>
              <p style={{ marginTop: 12 }}>默认密码见项目 README 或执行 seed 时的输出（由 DEMO_PASSWORD 配置）。不同角色看到的入口不同。</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
