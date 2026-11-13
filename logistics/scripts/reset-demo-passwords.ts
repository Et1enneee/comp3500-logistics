import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

/**
 * Legacy-database safety upgrade tool: rewrites existing demo account password hashes into real scrypt hashes.
 * - Only passwordHash is changed; no users, orders, inventory or ledger rows are deleted.
 * - Requires an explicit RESET_PASSWORDS=YES.
 * - By default only @demo.com demo accounts are processed; use --emails=a@x,b@x to specify others.
 * - DATABASE_URL_OVERRIDE can point at a temporary/backup database (used by the migration verification script).
 */
const password = process.env.DEMO_PASSWORD || process.env.RESET_PASSWORD || "Demo1234!";
const overrideUrl = process.env.DATABASE_URL_OVERRIDE;
const prisma = overrideUrl
  ? new PrismaClient({ datasources: { db: { url: overrideUrl } } })
  : new PrismaClient();

function targetEmails(): string[] | null {
  const arg = process.argv.find(value => value.startsWith("--emails="));
  if (!arg) return null;
  return arg.slice("--emails=".length).split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
}

async function main() {
  if (process.env.RESET_PASSWORDS !== "YES") {
    throw new Error("Refusing to modify passwords. Set RESET_PASSWORDS=YES explicitly and retry (this operation only rewrites hashes; it deletes no data).");
  }
  if (password.length < 8) throw new Error("The password must be at least 8 characters; provide it via DEMO_PASSWORD.");

  const emails = targetEmails();
  const targets = await prisma.user.findMany({
    where: emails ? { email: { in: emails } } : { email: { endsWith: "@demo.com" } },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });
  if (targets.length === 0) {
    console.log("No matching accounts; nothing was modified.");
    return;
  }
  const passwordHash = hashPassword(password);
  for (const user of targets) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(`Reset the password hash for ${user.email} (${user.role}); orders and inventory untouched.`);
  }
  // Also clear the old sessions of these accounts so stale cookies stop working.
  const cleared = await prisma.session.deleteMany({ where: { userId: { in: targets.map(user => user.id) } } });
  console.log(`Reset ${targets.length} account(s) in total and cleared ${cleared.count} old session(s). Password source: ${process.env.DEMO_PASSWORD ? "DEMO_PASSWORD" : process.env.RESET_PASSWORD ? "RESET_PASSWORD" : "default demo value"}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
