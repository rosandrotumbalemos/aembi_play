CREATE TYPE "public"."command_type" AS ENUM('reload', 'pause', 'resume', 'force_update', 'unpair');--> statement-breakpoint
CREATE TABLE "screen_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" uuid NOT NULL,
	"type" "command_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "screens" ADD COLUMN "emergency_message" text;--> statement-breakpoint
ALTER TABLE "screen_commands" ADD CONSTRAINT "screen_commands_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screen_commands_screen_id_idx" ON "screen_commands" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "screen_commands_pending_idx" ON "screen_commands" USING btree ("screen_id","delivered_at");