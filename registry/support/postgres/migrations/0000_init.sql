CREATE TABLE "support_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid,
	"ticket_id" uuid,
	"uploaded_by" text,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"content_id" text,
	"inline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_channel_state" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_contact_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_contact_identities_kind_value" UNIQUE("kind","value")
);
--> statement-breakpoint
CREATE TABLE "support_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"customer_id" text,
	"user_id" text,
	"locale" text,
	"blocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel_id" text,
	"author_id" text,
	"from" jsonb,
	"to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"text" text NOT NULL,
	"full_text" text,
	"html" text,
	"rfc_message_id" text,
	"in_reply_to" text,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_message_id" text,
	"delivery_status" text,
	"delivery_error" text,
	"auto" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_provider_id" UNIQUE("channel_id","provider_message_id")
);
--> statement-breakpoint
CREATE TABLE "support_reads" (
	"ticket_id" uuid NOT NULL,
	"reader_id" text NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_reads_ticket_id_reader_id_pk" PRIMARY KEY("ticket_id","reader_id")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "support_tickets_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel_id" text NOT NULL,
	"subject" text,
	"status" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"customer_id" text,
	"assignee_id" text,
	"reply_token" text NOT NULL,
	"provider_thread_id" text,
	"waiting_since" timestamp with time zone,
	"last_message_at" timestamp with time zone NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"solved_at" timestamp with time zone,
	"preview" text,
	"preview_kind" text,
	"preview_author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_number" UNIQUE("number"),
	CONSTRAINT "support_tickets_reply_token" UNIQUE("reply_token")
);
--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_message_id_support_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."support_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_contact_identities" ADD CONSTRAINT "support_contact_identities_contact_id_support_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."support_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_events" ADD CONSTRAINT "support_events_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_reads" ADD CONSTRAINT "support_reads_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_contact_id_support_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."support_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_attachments_message_idx" ON "support_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "support_contact_identities_contact_id_index" ON "support_contact_identities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "support_contacts_customer_idx" ON "support_contacts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "support_contacts_user_idx" ON "support_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_events_ticket_idx" ON "support_events" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_rfc_idx" ON "support_messages" USING btree ("rfc_message_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_waiting_idx" ON "support_tickets" USING btree ("status","waiting_since");--> statement-breakpoint
CREATE INDEX "support_tickets_status_recent_idx" ON "support_tickets" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "support_tickets_customer_idx" ON "support_tickets" USING btree ("customer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "support_tickets_contact_idx" ON "support_tickets" USING btree ("contact_id","channel_id");--> statement-breakpoint
CREATE INDEX "support_tickets_thread_idx" ON "support_tickets" USING btree ("channel_id","provider_thread_id");