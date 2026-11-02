CREATE TABLE "cv_base" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid,
	"company" text DEFAULT '' NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"language" text,
	"link" text,
	"offer_text" text NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"error" text,
	"analysis" jsonb,
	"cv" jsonb,
	"meta" jsonb,
	"checks" jsonb,
	"base_updated_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_offer_id_job_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_versions_created_idx" ON "cv_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cv_versions_offer_idx" ON "cv_versions" USING btree ("offer_id");--> statement-breakpoint
ALTER TABLE "job_offers" DROP COLUMN "tailored_cv";--> statement-breakpoint
ALTER TABLE "job_offers" DROP COLUMN "tailored_cv_at";