import { prisma } from "@/lib/prisma";
import { createAuthHandlers } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export const GET = createAuthHandlers(prisma).me;
