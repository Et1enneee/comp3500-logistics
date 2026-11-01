import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

/**
 * 旧库安全升级工具：把已有的演示账号密码哈希改为真实 scrypt 哈希。
 * - 只改 passwordHash，不删除用户、订单、库存或流水。
 * - 必须显式 RESET_PASSWORDS=YES。
 * - 默认只处理 @demo.com 演示账号，可用 --emails=a@x,b@x 指定。
 * - 可使用 DATABASE_URL_OVERRIDE 指向临时/备份库（迁移验证脚本会用）。
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
    throw new Error("拒绝修改密码。请显式设置 RESET_PASSWORDS=YES 后重试（该操作只改哈希，不删数据）。");
  }
  if (password.length < 8) throw new Error("密码至少 8 位；请通过 DEMO_PASSWORD 提供。");

  const emails = targetEmails();
  const targets = await prisma.user.findMany({
    where: emails ? { email: { in: emails } } : { email: { endsWith: "@demo.com" } },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });
  if (targets.length === 0) {
    console.log("没有匹配的账号；未修改任何数据。");
    return;
  }
  const passwordHash = hashPassword(password);
  for (const user of targets) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(`已重设 ${user.email}（${user.role}）的密码哈希；订单与库存未改动。`);
  }
  // 同时清空该批账号的旧会话，避免旧 Cookie 继续可用。
  const cleared = await prisma.session.deleteMany({ where: { userId: { in: targets.map(user => user.id) } } });
  console.log(`共重设 ${targets.length} 个账号，清理 ${cleared.count} 个旧会话。密码来源：${process.env.DEMO_PASSWORD ? "DEMO_PASSWORD" : process.env.RESET_PASSWORD ? "RESET_PASSWORD" : "默认演示值"}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
