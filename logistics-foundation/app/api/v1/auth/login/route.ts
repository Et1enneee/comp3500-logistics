import { prisma } from "@/lib/prisma";
import { createAuthHandlers } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export const POST = createAuthHandlers(prisma).login;
