import { prisma } from "@/lib/prisma";
import { createDriverHandlers } from "@/lib/driver-api";

export const dynamic = "force-dynamic";
export const GET = createDriverHandlers(prisma).list;
