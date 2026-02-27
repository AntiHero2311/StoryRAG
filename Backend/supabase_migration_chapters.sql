-- ============================================================
-- Migration: AddChaptersVersionsChunks
-- Applied: 2026-02-27
-- ============================================================

START TRANSACTION;

-- Enable pgvector for embedding support (Phase 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Chapters ──────────────────────────────────────────────────────────────────
CREATE TABLE "Chapters" (
    "Id"               uuid NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"        uuid NOT NULL,
    "ChapterNumber"    integer NOT NULL,
    "Title"            character varying(255),
    "WordCount"        integer NOT NULL DEFAULT 0,
    "Status"           character varying(20) NOT NULL DEFAULT 'Draft',
    "CurrentVersionId" uuid,                      -- Set sau khi version đầu tiên được tạo
    "CurrentVersionNum" integer NOT NULL DEFAULT 0,
    "IsDeleted"        boolean NOT NULL DEFAULT FALSE,
    "CreatedAt"        timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"        timestamp with time zone,
    CONSTRAINT "PK_Chapters" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Chapters_Projects" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "CK_Chapters_Status"
        CHECK ("Status" IN ('Draft','Final','Archived'))
);

CREATE UNIQUE INDEX "UQ_Chapter_Number" ON "Chapters" ("ProjectId", "ChapterNumber")
    WHERE "IsDeleted" = FALSE;

CREATE INDEX "IX_Chapters_ProjectId" ON "Chapters" ("ProjectId");

-- ── ChapterVersions ───────────────────────────────────────────────────────────
CREATE TABLE "ChapterVersions" (
    "Id"            uuid NOT NULL DEFAULT (uuid_generate_v4()),
    "ChapterId"     uuid NOT NULL,
    "VersionNumber" integer NOT NULL,
    "Content"       text NOT NULL,               -- AES-256 encrypted tại service layer
    "ChangeNote"    text,                         -- AES-256 encrypted tại service layer
    "WordCount"     integer NOT NULL DEFAULT 0,
    "TokenCount"    integer NOT NULL DEFAULT 0,
    "CreatedBy"     uuid NOT NULL,
    "IsChunked"     boolean NOT NULL DEFAULT FALSE,
    "IsEmbedded"    boolean NOT NULL DEFAULT FALSE,
    "CreatedAt"     timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ChapterVersions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ChapterVersions_Chapters" FOREIGN KEY ("ChapterId")
        REFERENCES "Chapters" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ChapterVersions_Users" FOREIGN KEY ("CreatedBy")
        REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "UQ_ChapterVersions" UNIQUE ("ChapterId", "VersionNumber")
);

CREATE INDEX "IX_ChapterVersions_ChapterId" ON "ChapterVersions" ("ChapterId");

-- ── Circular FK: Chapters.CurrentVersionId → ChapterVersions ─────────────────
ALTER TABLE "Chapters"
ADD CONSTRAINT "FK_Chapters_CurrentVersion" FOREIGN KEY ("CurrentVersionId")
    REFERENCES "ChapterVersions" ("Id") ON DELETE SET NULL;

-- ── ChapterChunks ─────────────────────────────────────────────────────────────
CREATE TABLE "ChapterChunks" (
    "Id"          uuid NOT NULL DEFAULT (uuid_generate_v4()),
    "VersionId"   uuid NOT NULL,
    "ProjectId"   uuid NOT NULL,
    "ChunkIndex"  integer NOT NULL,
    "Content"     text NOT NULL,                 -- AES-256 encrypted tại service layer
    "TokenCount"  integer NOT NULL DEFAULT 0,
    "Embedding"   vector(1536),                  -- NULL đến Phase 2 embedding
    "CreatedAt"   timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ChapterChunks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Chunks_Versions" FOREIGN KEY ("VersionId")
        REFERENCES "ChapterVersions" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Chunks_Projects" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_Chunks_VersionId"  ON "ChapterChunks" ("VersionId");
CREATE INDEX "IX_Chunks_ProjectId"  ON "ChapterChunks" ("ProjectId");

-- Index cho vector similarity search (Phase 2) – tạo sẵn, chỉ có hiệu lực khi có data
-- CREATE INDEX "IX_Chunks_Embedding" ON "ChapterChunks"
--     USING ivfflat ("Embedding" vector_cosine_ops) WITH (lists = 100);
-- Uncomment dòng trên khi chạy Phase 2 embedding

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260227000000_AddChaptersVersionsChunks', '9.0.2');

COMMIT;
