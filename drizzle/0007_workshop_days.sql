CREATE TABLE "workshop_days" (
	"day" date PRIMARY KEY NOT NULL,
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL
);
