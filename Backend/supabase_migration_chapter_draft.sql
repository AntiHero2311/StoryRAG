-- ============================================================
-- Migration: AddChapterDraft
-- Thêm 2 cột DraftContent + DraftSavedAt vào bảng Chapters
-- Applied: Run this on Supabase SQL Editor
-- ============================================================

ALTER TABLE "Chapters"
    ADD COLUMN IF NOT EXISTS "DraftContent"  TEXT         NULL,
    ADD COLUMN IF NOT EXISTS "DraftSavedAt"  TIMESTAMPTZ  NULL;
