import { prisma } from "@/lib/prisma";
import { createShipmentHandlers } from "@/lib/shipment-api";
export const POST = createShipmentHandlers(prisma).createShipment;
