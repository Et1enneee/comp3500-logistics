import { PrismaClient } from "@prisma/client";
const shared = globalThis as unknown as { logisticsPrisma?: PrismaClient };
export const prisma = shared.logisticsPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") shared.logisticsPrisma = prisma;
