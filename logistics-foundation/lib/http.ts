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

/** Transaction conflict / SQLite busy: bounded retry is allowed and 503 is returned. */
export function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code: unknown }).code);
  return code === "P2034" || code === "P1008";
}

export function failure(error: unknown, label: string): Response {
  if (error instanceof HttpError) return errorResponse(error.status, error.code, error.message);
  if (isRetryable(error)) return errorResponse(503, "TEMPORARILY_UNAVAILABLE", "The database is temporarily busy. Please try again later.");
  console.error(label, error instanceof Error ? error.name : "UnknownError");
  return errorResponse(500, "INTERNAL_ERROR", "The server failed to process the request. Please try again later.");
}

export function requireJson(req: Request): void {
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(400, "INVALID_ARGUMENT", "Requests must use application/json");
  }
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  requireJson(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "INVALID_ARGUMENT", "The request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_ARGUMENT", "The request body has an invalid format");
  }
  return body as Record<string, unknown>;
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Unified server-side identity and permission entry point:
 * 401 when not signed in; 403 when the role does not match; 403 when a write request
 * lacks or forges a CSRF token. Object-level checks such as order ownership stay in
 * the business functions so they can return privacy-preserving 404s where required.
 */
export async function requireSession(
  db: PrismaClient,
  req: Request,
  options: { roles?: Role[] } = {},
): Promise<Authenticated> {
  const authenticated = await readSession(db, req);
  if (!authenticated) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in first");
  if (options.roles && !options.roles.includes(authenticated.user.role)) {
    throw new HttpError(403, "FORBIDDEN", "Your current role is not allowed to perform this operation");
  }
  if (MUTATING.has(req.method)) {
    const token = req.headers.get(CSRF_HEADER);
    if (!token || token !== authenticated.session.csrfToken) {
      throw new HttpError(403, "CSRF_INVALID", "The write request lacks a valid anti-CSRF token. Please refresh the page and try again");
    }
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host");
      try {
        if (host && new URL(origin).host !== host) {
          throw new HttpError(403, "CSRF_INVALID", "The cross-site request was rejected");
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(403, "CSRF_INVALID", "The request origin could not be identified");
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
  if (values.length > 1) throw new HttpError(400, "INVALID_ARGUMENT", `The parameter ${name} must not be repeated`);
  return values[0] ?? null;
}

export function parsePagination(searchParams: URLSearchParams, defaultPageSize = 10, pageKey = "page"): Pagination {
  const pageRaw = queryValue(searchParams, pageKey);
  const sizeRaw = queryValue(searchParams, "pageSize");
  const page = pageRaw === null ? 1 : Number(pageRaw);
  const pageSize = sizeRaw === null ? defaultPageSize : Number(sizeRaw);
  if ((pageRaw !== null && !/^[1-9]\d*$/.test(pageRaw)) || !Number.isSafeInteger(page) || page < 1) {
    throw new HttpError(400, "INVALID_ARGUMENT", "The page number must be a positive integer");
  }
  if ((sizeRaw !== null && !/^[1-9]\d*$/.test(sizeRaw)) || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new HttpError(400, "INVALID_ARGUMENT", "The page size must be an integer between 1 and 50");
  }
  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip) || skip > 2147483647) throw new HttpError(400, "INVALID_ARGUMENT", "The page number is out of the processable range");
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
