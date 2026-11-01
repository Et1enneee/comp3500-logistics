import type { PrismaClient } from "@prisma/client";
import type { OrderApiErrorCode } from "@/types/orders";
import { CSRF_HEADER, readSession, type Authenticated, type Role } from "@/lib/auth";

export class HttpError extends Error {
  constructor(public status: number, public code: OrderApiErrorCode, message: string) {
    super(message);
  }
}

export function errorResponse(status: number, code: OrderApiErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** 事务冲突 / SQLite 忙：可有界重试并返回 503。 */
export function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code: unknown }).code);
  return code === "P2034" || code === "P1008";
}

export function failure(error: unknown, label: string): Response {
  if (error instanceof HttpError) return errorResponse(error.status, error.code, error.message);
  if (isRetryable(error)) return errorResponse(503, "TEMPORARILY_UNAVAILABLE", "数据库暂时繁忙，请稍后重试");
  console.error(label, error instanceof Error ? error.name : "UnknownError");
  return errorResponse(500, "INTERNAL_ERROR", "服务器处理失败，请稍后重试");
}

export function requireJson(req: Request): void {
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(400, "INVALID_ARGUMENT", "请求须使用 application/json");
  }
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  requireJson(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "INVALID_ARGUMENT", "请求体必须是有效 JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_ARGUMENT", "请求内容格式不正确");
  }
  return body as Record<string, unknown>;
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * 服务端统一的身份与权限入口：
 * 未登录 401；角色不符 403；写请求缺少/伪造 CSRF 令牌 403。
 * 订单归属等“对象级”判断留在各业务函数里，以便按需求返回隐匿性 404。
 */
export async function requireSession(
  db: PrismaClient,
  req: Request,
  options: { roles?: Role[] } = {},
): Promise<Authenticated> {
  const authenticated = await readSession(db, req);
  if (!authenticated) throw new HttpError(401, "UNAUTHENTICATED", "请先登录");
  if (options.roles && !options.roles.includes(authenticated.user.role)) {
    throw new HttpError(403, "FORBIDDEN", "当前角色无权执行该操作");
  }
  if (MUTATING.has(req.method)) {
    const token = req.headers.get(CSRF_HEADER);
    if (!token || token !== authenticated.session.csrfToken) {
      throw new HttpError(403, "CSRF_INVALID", "写请求缺少有效的防跨站令牌，请刷新页面后重试");
    }
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host");
      try {
        if (host && new URL(origin).host !== host) {
          throw new HttpError(403, "CSRF_INVALID", "跨站请求已被拒绝");
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(403, "CSRF_INVALID", "请求来源无法识别");
      }
    }
  }
  return authenticated;
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
}

export function queryValue(searchParams: URLSearchParams, name: string): string | null {
  const values = searchParams.getAll(name);
  if (values.length > 1) throw new HttpError(400, "INVALID_ARGUMENT", `参数 ${name} 不得重复`);
  return values[0] ?? null;
}

export function parsePagination(searchParams: URLSearchParams, defaultPageSize = 10, pageKey = "page"): Pagination {
  const pageRaw = queryValue(searchParams, pageKey);
  const sizeRaw = queryValue(searchParams, "pageSize");
  const page = pageRaw === null ? 1 : Number(pageRaw);
  const pageSize = sizeRaw === null ? defaultPageSize : Number(sizeRaw);
  if ((pageRaw !== null && !/^[1-9]\d*$/.test(pageRaw)) || !Number.isSafeInteger(page) || page < 1) {
    throw new HttpError(400, "INVALID_ARGUMENT", "页码须为正整数");
  }
  if ((sizeRaw !== null && !/^[1-9]\d*$/.test(sizeRaw)) || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new HttpError(400, "INVALID_ARGUMENT", "每页条数须为 1–50 的整数");
  }
  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip) || skip > 2147483647) throw new HttpError(400, "INVALID_ARGUMENT", "页码超出可处理范围");
  return { page, pageSize, skip };
}

export function paginated<T>(items: T[], total: number, pagination: Pagination) {
  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
