import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword, hashToken, SESSION_COOKIE } from "../lib/auth";

export interface TestDatabase {
  url: string;
  db: PrismaClient;
  peer: PrismaClient;
  dispose: () => Promise<void>;
}

/**
 * 每个测试文件使用独立临时 SQLite：
 * - 绝不连接项目 dev.db；
 * - schema 从 prisma/schema.prisma 复制并把 url 换成临时文件，
 *   保证“测试用的就是交付的 schema”。
 */
export async function createTestDatabase(prefix: string): Promise<TestDatabase> {
  const directory = await mkdtemp(join(tmpdir(), `${prefix}-`));
  const url = "file:" + join(directory, "test.db").replaceAll("\\", "/");
  const source = await readFile(resolve("prisma/schema.prisma"), "utf8");
  const matches = source.match(/url\s*=\s*"file:\.\/dev\.db"/g);
  if (matches?.length !== 1) {
    throw new Error("Expected a single SQLite dev.db URL in schema.prisma; refusing to run against an unexpected schema.");
  }
  const schemaPath = join(directory, "schema.prisma");
  await writeFile(schemaPath, source.replace(/url\s*=\s*"file:\.\/dev\.db"/, 'url = env("ORDER_TEST_DATABASE_URL")'));
  const require = createRequire(resolve("package.json"));
  execFileSync(
    process.execPath,
    [require.resolve("prisma/build/index.js"), "db", "push", "--schema", schemaPath, "--skip-generate"],
    { env: { ...process.env, ORDER_TEST_DATABASE_URL: url }, stdio: "pipe", timeout: 60000 },
  );
  const db = new PrismaClient({ datasources: { db: { url } } });
  const peer = new PrismaClient({ datasources: { db: { url } } });
  await db.$connect();
  await peer.$connect();
  return {
    url,
    db,
    peer,
    dispose: async () => {
      await peer.$disconnect();
      await db.$disconnect();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

export interface TestSession {
  cookie: string;
  csrf: string;
  token: string;
}

/** 直接在数据库里建会话（登录流程本身在 auth 测试里覆盖 http 层）。 */
export async function createTestSession(db: PrismaClient, userId: string, options: { expiresAt?: Date } = {}): Promise<TestSession> {
  const token = randomUUID();
  const csrf = randomUUID();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      csrfToken: csrf,
      userId,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { cookie: `${SESSION_COOKIE}=${token}`, csrf, token };
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  session?: TestSession | null;
  csrf?: string | null;
  headers?: Record<string, string>;
  rawBody?: string;
  contentType?: string;
}

export function apiRequest(url: string, options: RequestOptions = {}): Request {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined || options.rawBody !== undefined) {
    headers["content-type"] = options.contentType ?? "application/json";
  }
  if (options.session) headers.cookie = options.session.cookie;
  const csrf = options.csrf === undefined ? options.session?.csrf : options.csrf;
  if (csrf && method !== "GET") headers["x-csrf-token"] = csrf;
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  return new Request(url, { method, headers, body });
}

export async function expectApiError(response: Response, status: number, code: string) {
  assert.equal(response.status, status, `expected HTTP ${status}, got ${response.status}`);
  const data = await response.json();
  assert.equal(data.error.code, code);
  assert.equal(typeof data.error.message, "string");
  assert.ok(data.error.message.length > 0);
  assert.deepEqual(Object.keys(data), ["error"]);
  return data;
}

export interface FixtureUsers {
  customerA: { id: string; email: string; session: TestSession };
  customerB: { id: string; email: string; session: TestSession };
  staff: { id: string; email: string; session: TestSession };
  admin: { id: string; email: string; session: TestSession };
}

/** 四个角色账号 + 会话；密码哈希用生产同一实现。 */
export async function createUsers(db: PrismaClient): Promise<FixtureUsers> {
  const passwordHash = hashPassword("Demo1234!");
  const customerA = await db.user.create({ data: { email: "a@test.local", name: "客户A", passwordHash, role: "CUSTOMER" } });
  const customerB = await db.user.create({ data: { email: "b@test.local", name: "客户B", passwordHash, role: "CUSTOMER" } });
  const staff = await db.user.create({ data: { email: "staff@test.local", name: "员工", passwordHash, role: "STAFF" } });
  const admin = await db.user.create({ data: { email: "admin@test.local", name: "管理员", passwordHash, role: "ADMIN" } });
  return {
    customerA: { ...customerA, session: await createTestSession(db, customerA.id) },
    customerB: { ...customerB, session: await createTestSession(db, customerB.id) },
    staff: { ...staff, session: await createTestSession(db, staff.id) },
    admin: { ...admin, session: await createTestSession(db, admin.id) },
  };
}
