-- ============================================================
-- Migration: ChangeEmbeddingDimension_1536_to_768
-- Reason: Đổi sang LM Studio local LLM (nomic-embed-text = 768 dims)
-- Applied: Run this BEFORE starting Phase 2 embedding
-- ============================================================

-- Xoá dữ liệu embedding cũ (nếu có) trước khi đổi column type
UPDATE "ChapterChunks" SET "Embedding" = NULL WHERE "Embedding" IS NOT NULL;

-- Đổi column từ vector(1536) sang vector(768)
ALTER TABLE "ChapterChunks"
    ALTER COLUMN "Embedding" TYPE vector(768);

-- Reset IsEmbedded flag trên tất cả versions (vì embedding cũ không còn hợp lệ)
UPDATE "ChapterVersions" SET "IsEmbedded" = FALSE WHERE "IsEmbedded" = TRUE;

-- (Tuỳ chọn) Tạo IVFFlat index sau khi đã có đủ data (cần >= 100 rows)
-- CREATE INDEX "IX_Chunks_Embedding" ON "ChapterChunks"
--     USING ivfflat ("Embedding" vector_cosine_ops) WITH (lists = 100);
