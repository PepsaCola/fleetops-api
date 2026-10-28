CREATE TYPE "public"."work_order_kind" AS ENUM('service', 'repair', 'inspection', 'tyres');--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "work_orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 5001 CACHE 1),
	"vehicle_id" uuid NOT NULL,
	"kind" "work_order_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"cost_uah" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_ends_after_start" CHECK ("work_orders"."ends_at" > "work_orders"."starts_at"),
	CONSTRAINT "work_orders_cost_not_negative" CHECK ("work_orders"."cost_uah" >= 0)
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_orders_starts_at_index" ON "work_orders" USING btree ("starts_at");