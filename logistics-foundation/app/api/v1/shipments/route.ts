import { prisma } from "@/lib/prisma";
import { createShipmentHandlers } from "@/lib/shipment-api";

export const dynamic = "force-dynamic";

export const POST = createShipmentHandlers(prisma).createShipment;
