-- Optional assignment preserves all existing shipments; no driver is invented for historical records.
ALTER TABLE "Shipment" ADD COLUMN "driverId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Shipment_driverId_idx" ON "Shipment"("driverId");
