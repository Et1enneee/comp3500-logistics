import { PrismaClient } from "@prisma/client";

// 全项目共用一个 PrismaClient，避免开发时连接数爆炸
export const prisma = new PrismaClient();
