-- A vehicle or a driver can't be on two trips at once. The database enforces it itself, so two
-- dispatchers booking at the same moment can't both win. Cancelled trips hold nothing.
-- btree_gist lets one GiST index compare plain ids with = and time ranges with && (overlap).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, tstzrange("departs_at", "returns_at") WITH &&)
  WHERE ("cancelled_at" IS NULL);
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_no_overlap"
  EXCLUDE USING gist ("driver_id" WITH =, tstzrange("departs_at", "returns_at") WITH &&)
  WHERE ("cancelled_at" IS NULL);
