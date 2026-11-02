CREATE TYPE "public"."job_offer_status" AS ENUM('new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."job_source_kind" AS ENUM('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'personio', 'teamtailor', 'eightfold', 'workday', 'successfactors', 'careers_page', 'arbeitnow', 'himalayas', 'adzuna', 'jooble', 'remotive', 'remoteok', 'jobicy', 'weworkremotely', 'workingnomads', 'manual');--> statement-breakpoint
CREATE TABLE "advisor_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"website" text,
	"domain" text NOT NULL,
	"sector" text DEFAULT 'other' NOT NULL,
	"note" text,
	"source_url" text,
	"favourite" boolean DEFAULT false NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"careers_url" text,
	"careers_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fetch_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"host" text NOT NULL,
	"status" integer,
	"outcome" text NOT NULL,
	"bytes" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_state" (
	"host" text PRIMARY KEY NOT NULL,
	"robots_txt" text,
	"robots_status" integer,
	"robots_fetched_at" timestamp with time zone,
	"last_fetch_at" timestamp with time zone,
	"consecutive_errors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"company_id" uuid,
	"company_name" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"workplace" text DEFAULT 'unknown' NOT NULL,
	"employment_type" text,
	"department" text,
	"salary" text,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"score" integer DEFAULT 0 NOT NULL,
	"rule_score" integer DEFAULT 0 NOT NULL,
	"track" text DEFAULT 'core' NOT NULL,
	"field" text,
	"pivot" text DEFAULT 'none' NOT NULL,
	"figma_share" text DEFAULT 'unknown' NOT NULL,
	"match" jsonb DEFAULT '{"reasons":[],"region":"unknown","requiredLanguages":[],"hits":[]}'::jsonb NOT NULL,
	"ai" jsonb,
	"ai_scored_at" timestamp with time zone,
	"ai_error" text,
	"status" "job_offer_status" DEFAULT 'new' NOT NULL,
	"status_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"follow_up_at" timestamp with time zone,
	"note" text,
	"cover_letter" text,
	"cover_letter_lang" text,
	"cover_letter_at" timestamp with time zone,
	"tailored_cv" text,
	"tailored_cv_at" timestamp with time zone,
	"digested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "job_source_kind" NOT NULL,
	"token" text NOT NULL,
	"name" text NOT NULL,
	"company_id" uuid,
	"url" text,
	"supported" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"next_fetch_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"jobs_total" integer DEFAULT 0 NOT NULL,
	"jobs_kept" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"name" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"credits" double precision DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_messages_thread_idx" ON "advisor_messages" USING btree ("thread","created_at");--> statement-breakpoint
CREATE INDEX "app_events_open_idx" ON "app_events" USING btree ("resolved_at","level","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_domain_uq" ON "companies" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "companies_sector_idx" ON "companies" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "fetch_log_host_idx" ON "fetch_log" USING btree ("host","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_offers_source_ext_uq" ON "job_offers" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "job_offers_list_idx" ON "job_offers" USING btree ("status","score");--> statement-breakpoint
CREATE INDEX "job_offers_track_idx" ON "job_offers" USING btree ("track","score");--> statement-breakpoint
CREATE INDEX "job_offers_company_idx" ON "job_offers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_offers_seen_idx" ON "job_offers" USING btree ("first_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_kind_token_uq" ON "job_sources" USING btree ("kind","token");--> statement-breakpoint
CREATE INDEX "job_sources_due_idx" ON "job_sources" USING btree ("next_fetch_at");--> statement-breakpoint
CREATE INDEX "login_attempts_idx" ON "login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "provider_usage_time_idx" ON "provider_usage" USING btree ("created_at");