import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";
import { createOrderPost } from "@/lib/create-order";
export const POST = createOrderPost(prisma);
export const GET = createOrderHandlers(prisma).getOrder;
