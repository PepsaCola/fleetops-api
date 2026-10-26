CREATE TYPE "public"."driver_status" AS ENUM('active', 'on_leave', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('truck', 'van', 'car');--> statement-breakpoint
CREATE TABLE "depots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "depots_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"license_number" text NOT NULL,
	"license_categories" text[] NOT NULL,
	"license_expires_on" date NOT NULL,
	"medical_expires_on" date NOT NULL,
	"status" "driver_status" DEFAULT 'active' NOT NULL,
	"home_depot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "drivers_license_number_unique" UNIQUE("license_number")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"plate" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" smallint NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"capacity_kg" integer NOT NULL,
	"fuel_tank_l" integer NOT NULL,
	"odometer_km" integer NOT NULL,
	"home_depot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_home_depot_id_depots_id_fk" FOREIGN KEY ("home_depot_id") REFERENCES "public"."depots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_home_depot_id_depots_id_fk" FOREIGN KEY ("home_depot_id") REFERENCES "public"."depots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "depots_location_index" ON "depots" USING gist ("location");--> statement-breakpoint
CREATE INDEX "drivers_home_depot_id_index" ON "drivers" USING btree ("home_depot_id");--> statement-breakpoint
CREATE INDEX "drivers_status_index" ON "drivers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicles_home_depot_id_index" ON "vehicles" USING btree ("home_depot_id");--> statement-breakpoint
CREATE INDEX "vehicles_status_index" ON "vehicles" USING btree ("status");