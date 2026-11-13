import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

/** Add one local demo account without resetting orders or changing an existing account. */
const url = process.env.DATABASE_URL_OVERRIDE;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
async function main() {
  if (process.env.CREATE_DEMO_DRIVER !== "YES") throw new Error("Set CREATE_DEMO_DRIVER=YES to add the local demo driver account.");
  const email = "driver@demo.com";
  const existing = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    if (existing.role !== "DRIVER") throw new Error("The demo email already belongs to a non-driver; no changes made.");
    console.log("Demo driver already exists; password and data were not changed.");
    return;
  }
  const password = process.env.DEMO_PASSWORD || "Demo1234!";
  if (password.length < 8) throw new Error("The demo password must contain at least 8 characters.");
  await db.user.create({ data: { email, name: "Demo Driver", role: "DRIVER", passwordHash: hashPassword(password) } });
  console.log("Created local demo driver. Existing orders and other accounts were not changed.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
