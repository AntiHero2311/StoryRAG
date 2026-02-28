-- ============================================================
-- Migration: UpdateChapterVersionSchema
-- Thêm cột Title + UpdatedAt vào bảng ChapterVersions
-- Applied: Run this on Supabase SQL Editor
-- ============================================================

ALTER TABLE "ChapterVersions"
    ADD COLUMN IF NOT EXISTS "Title"     VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS "UpdatedAt" TIMESTAMPTZ  NULL;
