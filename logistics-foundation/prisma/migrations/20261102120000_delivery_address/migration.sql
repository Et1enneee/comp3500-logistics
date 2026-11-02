-- Preserve historical orders without inventing recipient addresses.
ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
