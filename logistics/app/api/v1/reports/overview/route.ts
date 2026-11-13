import { prisma } from "@/lib/prisma";
import { createReportHandlers } from "@/lib/reports-api";

export const dynamic = "force-dynamic";

export const GET = createReportHandlers(prisma).overview;
