-- CreateEnum
CREATE TYPE "PassPlatform" AS ENUM ('apple', 'google', 'web');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('in_person', 'virtual');

-- CreateEnum
CREATE TYPE "StampMethod" AS ENUM ('qr', 'code', 'manual');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "m365_object_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "location" TEXT,
    "track_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passes" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "platform" "PassPlatform" NOT NULL,
    "serial_number" TEXT NOT NULL,
    "auth_token" TEXT NOT NULL,
    "card_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_registrations" (
    "id" UUID NOT NULL,
    "pass_id" UUID NOT NULL,
    "device_library_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pass_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "checkin_opens_at" TIMESTAMP(3) NOT NULL,
    "checkin_closes_at" TIMESTAMP(3) NOT NULL,
    "qr_secret" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stamps" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "method" "StampMethod" NOT NULL,
    "added_by" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_tracks" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reward_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_tiers" (
    "id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "stamp_count" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "card_number" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by" UUID,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_m365_object_id_key" ON "employees"("m365_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "passes_serial_number_key" ON "passes"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "passes_card_token_key" ON "passes"("card_token");

-- CreateIndex
CREATE UNIQUE INDEX "passes_employee_id_platform_key" ON "passes"("employee_id", "platform");

-- CreateIndex
CREATE INDEX "pass_registrations_device_library_id_idx" ON "pass_registrations"("device_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "pass_registrations_pass_id_device_library_id_key" ON "pass_registrations"("pass_id", "device_library_id");

-- CreateIndex
CREATE INDEX "events_checkin_opens_at_checkin_closes_at_idx" ON "events"("checkin_opens_at", "checkin_closes_at");

-- CreateIndex
CREATE INDEX "stamps_event_id_created_at_idx" ON "stamps"("event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stamps_employee_id_event_id_key" ON "stamps"("employee_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_tracks_slug_key" ON "reward_tracks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "reward_tiers_track_id_stamp_count_key" ON "reward_tiers"("track_id", "stamp_count");

-- CreateIndex
CREATE INDEX "rewards_redeemed_at_idx" ON "rewards"("redeemed_at");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_employee_id_card_number_tier_key" ON "rewards"("employee_id", "card_number", "tier");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "reward_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_registrations" ADD CONSTRAINT "pass_registrations_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_tiers" ADD CONSTRAINT "reward_tiers_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "reward_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
