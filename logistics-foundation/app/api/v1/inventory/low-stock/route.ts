import { prisma } from "@/lib/prisma";
import { createInventoryHandlers } from "@/lib/inventory-api";

export const dynamic = "force-dynamic";

export const GET = createInventoryHandlers(prisma).listLowStock;
