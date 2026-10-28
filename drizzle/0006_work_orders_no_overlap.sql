-- A vehicle is in the workshop for one work order at a time; cancelled ones hold nothing.
-- Trips and work orders live in different tables, so the API checks those against each other.
-- btree_gist was enabled with the trips' constraints (0003).
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("cancelled_at" IS NULL);
