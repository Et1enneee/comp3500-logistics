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
          <p className="eyebrow">Sign In</p>
          <h1>Enter the Logistics Workspace</h1>
          <p className="subtitle">Customers place orders and track them; staff fulfill orders and manage inventory; drivers update their assigned simulated deliveries; administrators get read-only operations reports. Identity and permissions are determined entirely by the server-side session.</p>
        </div>
        <section className="card login-card">
          <div className="card-body">
            <LoginForm nextPath={nextPath} />
            <div className="login-help">
              <strong>Local demo accounts</strong>
              <ul>
                <li>customer.a@demo.com · Demo Customer A</li>
                <li>customer.b@demo.com · Demo Customer B</li>
                <li>staff@demo.com · Demo Staff</li>
                <li>driver@demo.com · Demo Driver</li>
                <li>admin@demo.com · Demo Administrator (read-only)</li>
              </ul>
              <p style={{ marginTop: 12 }}>The default password is documented in the project README and printed by the seed script (configurable via DEMO_PASSWORD). Each role lands on a different home page.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
