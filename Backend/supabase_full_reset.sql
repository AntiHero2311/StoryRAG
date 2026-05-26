-- ============================================================
-- StoryRAG — Full Reset & Init
-- Xóa toàn bộ tables + data, tạo lại từ đầu theo schema mới nhất.
-- Chạy file này trên Supabase SQL Editor.
-- Sau khi chạy, EF sẽ KHÔNG cần migrate lại (history đã được ghi sẵn).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- BƯỚC 1: XÓA TOÀN BỘ (CASCADE để tránh lỗi FK)
-- ────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "Notifications"         CASCADE;
DROP TABLE IF EXISTS "Payments"              CASCADE;
DROP TABLE IF EXISTS "character_relationships"   CASCADE;
DROP TABLE IF EXISTS "analysis_job_rerun_audits" CASCADE;
DROP TABLE IF EXISTS "writing_tips"              CASCADE;
DROP TABLE IF EXISTS "faqs"                      CASCADE;
DROP TABLE IF EXISTS "system_config"             CASCADE;
DROP TABLE IF EXISTS "BugReports"            CASCADE;
DROP TABLE IF EXISTS "StaffAnalysisReviews"  CASCADE;
DROP TABLE IF EXISTS "StaffKnowledgeBaseItems" CASCADE;
DROP TABLE IF EXISTS "StaffFeedbacks"        CASCADE;
DROP TABLE IF EXISTS "TimelineEvents"       CASCADE;
DROP TABLE IF EXISTS "RewriteHistories"      CASCADE;
DROP TABLE IF EXISTS "AiAnalysisHistories"   CASCADE;
DROP TABLE IF EXISTS "ChatMessages"          CASCADE;
DROP TABLE IF EXISTS "ProjectAbuseFlags"     CASCADE;
DROP TABLE IF EXISTS "WorldbuildingEntries"  CASCADE;
DROP TABLE IF EXISTS "PlotNoteEntries"       CASCADE;
DROP TABLE IF EXISTS "ThemeEntries"          CASCADE;
DROP TABLE IF EXISTS "StyleGuideEntries"     CASCADE;
DROP TABLE IF EXISTS "CharacterEntries"      CASCADE;
DROP TABLE IF EXISTS "UserSettings"          CASCADE;
DROP TABLE IF EXISTS "ProjectAnalysisFacts"  CASCADE;
DROP TABLE IF EXISTS "ProjectAnalysisJobs"   CASCADE;
DROP TABLE IF EXISTS "ReportItems"           CASCADE;
DROP TABLE IF EXISTS "ProjectReports"        CASCADE;
DROP TABLE IF EXISTS "ProjectGenres"         CASCADE;
DROP TABLE IF EXISTS "ChapterChunks"         CASCADE;
DROP TABLE IF EXISTS "ChapterVersions"       CASCADE;
DROP TABLE IF EXISTS "Chapters"              CASCADE;
DROP TABLE IF EXISTS "UserSubscriptions"     CASCADE;
DROP TABLE IF EXISTS "Projects"              CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlans"     CASCADE;
DROP TABLE IF EXISTS "Genres"                CASCADE;
DROP TABLE IF EXISTS "Users"                 CASCADE;
DROP TABLE IF EXISTS "__EFMigrationsHistory" CASCADE;

-- ────────────────────────────────────────────────────────────
-- BƯỚC 2: EXTENSIONS
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────
-- BƯỚC 3: EF MIGRATIONS HISTORY
-- ────────────────────────────────────────────────────────────

CREATE TABLE "__EFMigrationsHistory" (
    "MigrationId"    character varying(150) NOT NULL,
    "ProductVersion" character varying(32)  NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- ────────────────────────────────────────────────────────────
-- BƯỚC 4: TẠO TABLES (theo thứ tự dependency)
-- ────────────────────────────────────────────────────────────

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE "Users" (
    "Id"                           uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "FullName"                     character varying(100)   NOT NULL,
    "Email"                        character varying(100)   NOT NULL,
    "PasswordHash"                 text                     NOT NULL,
    "PasswordSalt"                 text                     NOT NULL,
    "PasswordFormatVersion"        integer                  NOT NULL DEFAULT 1,
    "AvatarURL"                    character varying(500),
    "Role"                         character varying(20)    NOT NULL,
    "IsActive"                     boolean                  NOT NULL DEFAULT TRUE,
    "DataEncryptionKey"            text,
    "CreatedAt"                    timestamp with time zone NOT NULL DEFAULT NOW(),
    "RefreshToken"                 text,
    "RefreshTokenExpiryTime"       timestamp with time zone,
    "PasswordResetToken"           text,
    "PasswordResetTokenExpiryTime" timestamp with time zone,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Users_Role" CHECK ("Role" IN ('Admin','Author','Staff'))
);

CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");

-- ── Notifications ──────────────────────────────────────────────
CREATE TABLE "Notifications" (
    "Id"              uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "UserId"          uuid                     NOT NULL,
    "CreatedByUserId" uuid,
    "Type"            character varying(20)    NOT NULL DEFAULT 'info',
    "Title"           character varying(200)   NOT NULL,
    "Message"         character varying(3000)  NOT NULL,
    "Tag"             character varying(120),
    "IsRead"          boolean                  NOT NULL DEFAULT FALSE,
    "CreatedAt"       timestamp with time zone NOT NULL DEFAULT NOW(),
    "ReadAt"          timestamp with time zone,
    CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Notifications_Type" CHECK ("Type" IN ('success','error','info','warning')),
    CONSTRAINT "FK_Notifications_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Notifications_Users_CreatedByUserId" FOREIGN KEY ("CreatedByUserId")
        REFERENCES "Users" ("Id") ON DELETE SET NULL
);

CREATE INDEX "IX_Notifications_CreatedByUserId" ON "Notifications" ("CreatedByUserId");
CREATE INDEX "IX_Notifications_UserId_CreatedAt" ON "Notifications" ("UserId","CreatedAt");
CREATE INDEX "IX_Notifications_UserId_IsRead" ON "Notifications" ("UserId","IsRead");
CREATE INDEX "IX_Notifications_UserId_Tag" ON "Notifications" ("UserId","Tag") WHERE "Tag" IS NOT NULL;

-- ── SubscriptionPlans ────────────────────────────────────────
CREATE TABLE "SubscriptionPlans" (
    "Id"               integer          GENERATED BY DEFAULT AS IDENTITY,
    "PlanName"         character varying(50)    NOT NULL,
    "Price"            numeric(18,2)            NOT NULL DEFAULT 0,
    "MaxAnalysisCount" integer                  NOT NULL DEFAULT 10,
    "MaxTokenLimit"    bigint                   NOT NULL DEFAULT 50000,
    "Description"      text,
    "IsActive"         boolean                  NOT NULL DEFAULT TRUE,
    CONSTRAINT "PK_SubscriptionPlans" PRIMARY KEY ("Id")
);

-- ── Genres ───────────────────────────────────────────────────
CREATE TABLE "Genres" (
    "Id"          integer                  GENERATED BY DEFAULT AS IDENTITY,
    "Name"        character varying(100)   NOT NULL,
    "Slug"        character varying(100)   NOT NULL,
    "Color"       character varying(20)    NOT NULL DEFAULT '#6366f1',
    "Description" character varying(500),
    CONSTRAINT "PK_Genres" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "IX_Genres_Slug" ON "Genres" ("Slug");

-- ── Projects ─────────────────────────────────────────────────
CREATE TABLE "Projects" (
    "Id"            uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "AuthorId"      uuid                     NOT NULL,
    "Title"         text                     NOT NULL,
    "Summary"       text,
    "AiInstructions" text,
    "SummaryEmbedding" vector(768),
    "CoverImageURL" character varying(500),
    "Status"        character varying(20)    NOT NULL DEFAULT 'Draft',
    "IsDeleted"     boolean                  NOT NULL DEFAULT FALSE,
    "CreatedAt"     timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"     timestamp with time zone,
    CONSTRAINT "PK_Projects" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Projects_Status" CHECK ("Status" IN ('Draft','Published','Archived')),
    CONSTRAINT "FK_Projects_Users_AuthorId" FOREIGN KEY ("AuthorId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_Projects_AuthorId" ON "Projects" ("AuthorId");

-- ── UserSubscriptions ────────────────────────────────────────
CREATE TABLE "UserSubscriptions" (
    "Id"                integer                  GENERATED BY DEFAULT AS IDENTITY,
    "UserId"            uuid                     NOT NULL,
    "PlanId"            integer                  NOT NULL,
    "StartDate"         timestamp with time zone NOT NULL,
    "EndDate"           timestamp with time zone NOT NULL,
    "Status"            character varying(20)    NOT NULL DEFAULT 'Active',
    "UsedAnalysisCount" integer                  NOT NULL DEFAULT 0,
    "UsedTokens"        bigint                   NOT NULL DEFAULT 0,
    "CreatedAt"         timestamp with time zone NOT NULL DEFAULT NOW(),
    "NextPlanId"        integer,
    CONSTRAINT "PK_UserSubscriptions" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_UserSub_Status" CHECK ("Status" IN ('Active','Expired','Cancelled')),
    CONSTRAINT "FK_UserSubscriptions_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_UserSubscriptions_SubscriptionPlans_PlanId" FOREIGN KEY ("PlanId")
        REFERENCES "SubscriptionPlans" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_UserSubscriptions_SubscriptionPlans_NextPlanId" FOREIGN KEY ("NextPlanId")
        REFERENCES "SubscriptionPlans" ("Id")
);

CREATE INDEX "IX_UserSubscriptions_UserId"  ON "UserSubscriptions" ("UserId");
CREATE INDEX "IX_UserSubscriptions_PlanId"  ON "UserSubscriptions" ("PlanId");
CREATE INDEX "IX_UserSubscriptions_NextPlanId" ON "UserSubscriptions" ("NextPlanId");

-- ── ProjectGenres ────────────────────────────────────────────
CREATE TABLE "ProjectGenres" (
    "ProjectId" uuid    NOT NULL,
    "GenreId"   integer NOT NULL,
    CONSTRAINT "PK_ProjectGenres" PRIMARY KEY ("ProjectId", "GenreId"),
    CONSTRAINT "FK_ProjectGenres_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProjectGenres_Genres_GenreId" FOREIGN KEY ("GenreId")
        REFERENCES "Genres" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ProjectGenres_GenreId" ON "ProjectGenres" ("GenreId");

-- ── ProjectAbuseFlags (AbuseDetector / rate limit — staff API flagged-projects)
CREATE TABLE "ProjectAbuseFlags" (
    "Id"          uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"   uuid                     NOT NULL,
    "UserId"      uuid                     NOT NULL,
    "FlagReason"  character varying(500)   NOT NULL,
    "Severity"    character varying(20)    NOT NULL DEFAULT 'Warning',
    "FlaggedAt"   timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ProjectAbuseFlags" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_ProjectAbuseFlags_Severity" CHECK ("Severity" IN ('Warning','Critical')),
    CONSTRAINT "FK_ProjectAbuseFlags_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProjectAbuseFlags_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ProjectAbuseFlags_ProjectId" ON "ProjectAbuseFlags" ("ProjectId");
CREATE INDEX "IX_ProjectAbuseFlags_UserId"    ON "ProjectAbuseFlags" ("UserId");
CREATE INDEX "IX_ProjectAbuseFlags_FlaggedAt" ON "ProjectAbuseFlags" ("FlaggedAt");

-- ── ChapterVersions (tạo trước để Chapters có thể FK vào) ───
-- Tạm thời chưa có FK ngược từ Chapters → ChapterVersions
CREATE TABLE "ChapterVersions" (
    "Id"            uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ChapterId"     uuid                     NOT NULL,
    "VersionNumber" integer                  NOT NULL,
    "Content"       text                     NOT NULL,
    "ChangeNote"    text,
    "WordCount"     integer                  NOT NULL DEFAULT 0,
    "TokenCount"    integer                  NOT NULL DEFAULT 0,
    "CreatedBy"     uuid                     NOT NULL,
    "IsChunked"     boolean                  NOT NULL DEFAULT FALSE,
    "IsEmbedded"    boolean                  NOT NULL DEFAULT FALSE,
    "IsPinned"      boolean                  NOT NULL DEFAULT FALSE,
    "Title"         character varying(255),
    "UpdatedAt"     timestamp with time zone,
    "CreatedAt"     timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ChapterVersions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ChapterVersions_Users_CreatedBy" FOREIGN KEY ("CreatedBy")
        REFERENCES "Users" ("Id") ON DELETE RESTRICT
    -- FK_ChapterVersions_Chapters sẽ thêm sau khi tạo bảng Chapters
);

-- ── Chapters ─────────────────────────────────────────────────
CREATE TABLE "Chapters" (
    "Id"                uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"         uuid                     NOT NULL,
    "ChapterNumber"     integer                  NOT NULL,
    "Title"             character varying(255),
    "WordCount"         integer                  NOT NULL DEFAULT 0,
    "Status"            character varying(20)    NOT NULL DEFAULT 'Draft',
    "CurrentVersionId"  uuid,
    "CurrentVersionNum" integer                  NOT NULL DEFAULT 0,
    "IsDeleted"         boolean                  NOT NULL DEFAULT FALSE,
    "DraftContent"      text,
    "DraftSavedAt"      timestamp with time zone,
    "CreatedAt"         timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"         timestamp with time zone,
    CONSTRAINT "PK_Chapters" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Chapters_Status" CHECK ("Status" IN ('Draft','Final','Archived')),
    CONSTRAINT "FK_Chapters_Projects" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Chapters_CurrentVersion" FOREIGN KEY ("CurrentVersionId")
        REFERENCES "ChapterVersions" ("Id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "UQ_Chapter_Number"   ON "Chapters" ("ProjectId", "ChapterNumber") WHERE "IsDeleted" = FALSE;
CREATE INDEX        "IX_Chapters_ProjectId"      ON "Chapters" ("ProjectId");
CREATE INDEX        "IX_Chapters_CurrentVersionId" ON "Chapters" ("CurrentVersionId");

-- Thêm FK ngược từ ChapterVersions → Chapters (circular, phải sau khi Chapters tồn tại)
ALTER TABLE "ChapterVersions"
    ADD CONSTRAINT "FK_ChapterVersions_Chapters_ChapterId" FOREIGN KEY ("ChapterId")
        REFERENCES "Chapters" ("Id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "UQ_ChapterVersions"          ON "ChapterVersions" ("ChapterId", "VersionNumber");
CREATE INDEX        "IX_ChapterVersions_ChapterId" ON "ChapterVersions" ("ChapterId");
CREATE INDEX        "IX_ChapterVersions_CreatedBy" ON "ChapterVersions" ("CreatedBy");

-- ── ChapterChunks ─────────────────────────────────────────────
CREATE TABLE "ChapterChunks" (
    "Id"         uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "VersionId"  uuid                     NOT NULL,
    "ProjectId"  uuid                     NOT NULL,
    "ChunkIndex" integer                  NOT NULL,
    "Content"    text                     NOT NULL,
    "TokenCount" integer                  NOT NULL DEFAULT 0,
    "Embedding"  vector(768),
    "CreatedAt"  timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ChapterChunks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ChapterChunks_Versions_VersionId" FOREIGN KEY ("VersionId")
        REFERENCES "ChapterVersions" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ChapterChunks_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ChapterChunks_VersionId"  ON "ChapterChunks" ("VersionId");
CREATE INDEX "IX_ChapterChunks_ProjectId"  ON "ChapterChunks" ("ProjectId");

-- IVFFlat index cho vector search (uncomment sau khi có >= 100 rows embedding)
-- CREATE INDEX "IX_ChapterChunks_Embedding" ON "ChapterChunks"
--     USING ivfflat ("Embedding" vector_cosine_ops) WITH (lists = 100);

-- ── UserSettings ─────────────────────────────────────────────
CREATE TABLE "UserSettings" (
    "UserId"         uuid                  NOT NULL,
    "EditorFont"     character varying(100) NOT NULL DEFAULT 'Be Vietnam Pro',
    "EditorFontSize" integer               NOT NULL DEFAULT 17,
    CONSTRAINT "PK_UserSettings" PRIMARY KEY ("UserId"),
    CONSTRAINT "FK_UserSettings_Users" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

-- ── ProjectReports ────────────────────────────────────────────
CREATE TABLE "ProjectReports" (
    "Id"             uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"      uuid                     NOT NULL,
    "UserId"         uuid                     NOT NULL,
    "Status"         character varying(20)    NOT NULL DEFAULT 'Pending',
    "TotalScore"     numeric(5,2)             NOT NULL DEFAULT 0,
    "CriteriaJson"   jsonb                    NOT NULL DEFAULT '[]',
    "ProjectVersion" character varying(50)    NOT NULL DEFAULT 'v1.0.0',
    "CreatedAt"      timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"      timestamp with time zone,
    CONSTRAINT "PK_ProjectReports" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_ProjectReports_Status" CHECK ("Status" IN ('Pending','Completed','Failed','MockData')),
    CONSTRAINT "FK_ProjectReports_Projects" FOREIGN KEY ("ProjectId") REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProjectReports_Users"    FOREIGN KEY ("UserId")    REFERENCES "Users"    ("Id") ON DELETE CASCADE
);

-- ── ReportItems (Stage 2 rubric row ↔ evidence chunk ids, JSONB mảng số nguyên) ──
CREATE TABLE "ReportItems" (
    "Id"               uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "ProjectReportId"  uuid                     NOT NULL,
    "CriterionKey"     character varying(20)    NOT NULL,
    "EvidenceChunkIds" jsonb,
    CONSTRAINT "PK_ReportItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ReportItems_ProjectReports_ProjectReportId" FOREIGN KEY ("ProjectReportId")
        REFERENCES "ProjectReports" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "IX_ReportItems_ProjectReportId_CriterionKey"
    ON "ReportItems" ("ProjectReportId", "CriterionKey");

-- ── ProjectAnalysisJobs ────────────────────────────────────────
CREATE TABLE "ProjectAnalysisJobs" (
    "Id"                 uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "ProjectId"          uuid                     NOT NULL,
    "UserId"             uuid                     NOT NULL,
    "Status"             character varying(20)    NOT NULL DEFAULT 'Queued',
    "Stage"              character varying(30)    NOT NULL DEFAULT 'Queued',
    "Progress"           integer                  NOT NULL DEFAULT 0,
    "ProjectVersionHash" character varying(128)   NOT NULL DEFAULT '',
    "ReportId"           uuid,
    "RetriedFromId"      uuid,
    "ErrorMessage"       character varying(2000),
    "CreatedAt"          timestamp with time zone NOT NULL DEFAULT NOW(),
    "StartedAt"          timestamp with time zone,
    "CompletedAt"        timestamp with time zone,
    "UpdatedAt"          timestamp with time zone DEFAULT NOW(),
    CONSTRAINT "PK_ProjectAnalysisJobs" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_ProjectAnalysisJobs_Progress" CHECK ("Progress" >= 0 AND "Progress" <= 100),
    CONSTRAINT "CK_ProjectAnalysisJobs_Stage" CHECK ("Stage" IN ('Queued','Preparing','Analyzing','Saving','Completed','Failed','Cancelled')),
    CONSTRAINT "CK_ProjectAnalysisJobs_Status" CHECK ("Status" IN ('Queued','Processing','Completed','Failed','Cancelled')),
    CONSTRAINT "FK_ProjectAnalysisJobs_ProjectReports_ReportId" FOREIGN KEY ("ReportId")
        REFERENCES "ProjectReports" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_ProjectAnalysisJobs_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProjectAnalysisJobs_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ProjectAnalysisJobs_ProjectId_UserId_CreatedAt"
    ON "ProjectAnalysisJobs" ("ProjectId", "UserId", "CreatedAt");
CREATE INDEX "IX_ProjectAnalysisJobs_ProjectId_UserId_ProjectVersionHash_Sta~"
    ON "ProjectAnalysisJobs" ("ProjectId", "UserId", "ProjectVersionHash", "Status");
CREATE INDEX "IX_ProjectAnalysisJobs_ReportId" ON "ProjectAnalysisJobs" ("ReportId");
CREATE UNIQUE INDEX "IX_ProjectAnalysisJobs_UserId_Active"
    ON "ProjectAnalysisJobs" ("UserId")
    WHERE "Status" IN ('Queued','Processing');
CREATE INDEX "IX_ProjectAnalysisJobs_RetriedFromId" ON "ProjectAnalysisJobs" ("RetriedFromId");

-- ── ProjectAnalysisFacts (Stage 1 extraction JSONB, RAG / Stage 2) ──
CREATE TABLE "ProjectAnalysisFacts" (
    "Id"        uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "ProjectId" uuid                     NOT NULL,
    "RunId"     uuid                     NOT NULL,
    "Payload"   jsonb                    NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ProjectAnalysisFacts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProjectAnalysisFacts_ProjectAnalysisJobs_RunId" FOREIGN KEY ("RunId")
        REFERENCES "ProjectAnalysisJobs" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProjectAnalysisFacts_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ProjectAnalysisFacts_ProjectId_RunId" ON "ProjectAnalysisFacts" ("ProjectId", "RunId");
CREATE INDEX "IX_ProjectAnalysisFacts_RunId" ON "ProjectAnalysisFacts" ("RunId");

-- ── WorldbuildingEntries ──────────────────────────────────────
-- Valid Category values:
--   Primary: Setting (Bối cảnh), Location (Địa điểm), Rules (Quy tắc thế giới),
--            Glossary (Thuật ngữ), Timeline (Dòng thời gian)
--   Extended: Magic, History, Religion, Geography, Technology, World, Other
CREATE TABLE "WorldbuildingEntries" (
    "Id"        uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId" uuid                     NOT NULL,
    "Title"     text                     NOT NULL,
    "Content"   text                     NOT NULL DEFAULT '',
    "Category"  character varying(50)    NOT NULL DEFAULT 'Other',
    "Embedding" vector(768),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_WorldbuildingEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WorldbuildingEntries_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_WorldbuildingEntries_ProjectId" ON "WorldbuildingEntries" ("ProjectId");

-- IVFFlat index cho vector search (uncomment sau khi có >= 100 rows embedding)
-- CREATE INDEX "IX_WorldbuildingEntries_Embedding" ON "WorldbuildingEntries"
--     USING ivfflat ("Embedding" vector_cosine_ops) WITH (lists = 100);

-- ── CharacterEntries ──────────────────────────────────────────
CREATE TABLE "CharacterEntries" (
    "Id"          uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"   uuid                     NOT NULL,
    "Name"        text                     NOT NULL,
    "Role"        character varying(50)    NOT NULL DEFAULT 'Supporting',
    "Description" text                     NOT NULL DEFAULT '',
    "Background"  text,
    "Notes"       text,
    "Embedding"   vector(768),
    "CreatedAt"   timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"   timestamp with time zone,
    CONSTRAINT "PK_CharacterEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_CharacterEntries_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_CharacterEntries_ProjectId" ON "CharacterEntries" ("ProjectId");

-- IVFFlat index cho vector search (uncomment sau khi có >= 100 rows embedding)
-- CREATE INDEX "IX_CharacterEntries_Embedding" ON "CharacterEntries"
--     USING ivfflat ("Embedding" vector_cosine_ops) WITH (lists = 100);

-- ── StyleGuideEntries ─────────────────────────────────────────
CREATE TABLE "StyleGuideEntries" (
    "Id"        uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId" uuid                     NOT NULL,
    "Aspect"    character varying(50)    NOT NULL DEFAULT 'Other',
    "Content"   text                     NOT NULL DEFAULT '',
    "Embedding" vector(768),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_StyleGuideEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_StyleGuideEntries_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_StyleGuideEntries_ProjectId" ON "StyleGuideEntries" ("ProjectId");

-- ── ThemeEntries ──────────────────────────────────────────────
CREATE TABLE "ThemeEntries" (
    "Id"          uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"   uuid                     NOT NULL,
    "Title"       text                     NOT NULL,
    "Description" text                     NOT NULL DEFAULT '',
    "Notes"       text,
    "Embedding"   vector(768),
    "CreatedAt"   timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"   timestamp with time zone,
    CONSTRAINT "PK_ThemeEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ThemeEntries_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ThemeEntries_ProjectId" ON "ThemeEntries" ("ProjectId");

-- ── PlotNoteEntries ───────────────────────────────────────────
CREATE TABLE "PlotNoteEntries" (
    "Id"        uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId" uuid                     NOT NULL,
    "Type"      character varying(50)    NOT NULL DEFAULT 'Other',
    "Title"     text                     NOT NULL,
    "Content"   text                     NOT NULL DEFAULT '',
    "Embedding" vector(768),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_PlotNoteEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PlotNoteEntries_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_PlotNoteEntries_ProjectId" ON "PlotNoteEntries" ("ProjectId");

-- ── TimelineEvents ─────────────────────────────────────────────────
-- Category: Story | Historical | Character | World | Political | Other
-- Importance: Critical | Major | Normal | Minor
CREATE TABLE "TimelineEvents" (
    "Id"          uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"   uuid                     NOT NULL,
    "Category"    character varying(50)    NOT NULL DEFAULT 'Story',
    "Title"       text                     NOT NULL,
    "Description" text                     NOT NULL DEFAULT '',
    "TimeLabel"   character varying(100),
    "SortOrder"   integer                  NOT NULL DEFAULT 0,
    "Importance"  character varying(20)    NOT NULL DEFAULT 'Normal',
    "CreatedAt"   timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"   timestamp with time zone,
    CONSTRAINT "PK_TimelineEvents" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TimelineEvents_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_TimelineEvents_ProjectId_SortOrder" ON "TimelineEvents" ("ProjectId", "SortOrder");

-- ── ChatMessages ──────────────────────────────────────────────
CREATE TABLE "ChatMessages" (
    "Id"           uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"    uuid                     NOT NULL,
    "UserId"       uuid                     NOT NULL,
    "Question"     text                     NOT NULL,
    "Answer"       text                     NOT NULL,
    "InputTokens"  integer                  NOT NULL DEFAULT 0,
    "OutputTokens" integer                  NOT NULL DEFAULT 0,
    "TotalTokens"  integer                  NOT NULL DEFAULT 0,
    "CreatedAt"    timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_ChatMessages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ChatMessages_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ChatMessages_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_ChatMessages_ProjectId_UserId" ON "ChatMessages" ("ProjectId", "UserId");
CREATE INDEX "IX_ChatMessages_UserId"           ON "ChatMessages" ("UserId");

-- ── RewriteHistories ──────────────────────────────────────────
CREATE TABLE "RewriteHistories" (
    "Id"            uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"     uuid                     NOT NULL,
    "ChapterId"     uuid,
    "UserId"        uuid                     NOT NULL,
    "OriginalText"  text                     NOT NULL,
    "RewrittenText" text                     NOT NULL,
    "Instruction"   text                     NOT NULL DEFAULT '',
    "ActionType"    text                     NOT NULL DEFAULT '',
    "TotalTokens"   integer                  NOT NULL DEFAULT 0,
    "CreatedAt"     timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_RewriteHistories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RewriteHistories_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_RewriteHistories_Chapters_ChapterId" FOREIGN KEY ("ChapterId")
        REFERENCES "Chapters" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_RewriteHistories_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_RewriteHistories_ProjectId_UserId" ON "RewriteHistories" ("ProjectId", "UserId");
CREATE INDEX "IX_RewriteHistories_UserId"            ON "RewriteHistories" ("UserId");
CREATE INDEX "IX_RewriteHistories_ChapterId"         ON "RewriteHistories" ("ChapterId");

-- ── AiAnalysisHistories ───────────────────────────────────────
CREATE TABLE "AiAnalysisHistories" (
    "Id"               uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "ProjectId"        uuid                     NOT NULL,
    "ChapterId"        uuid,
    "UserId"           uuid                     NOT NULL,
    "AnalysisType"     character varying(50)    NOT NULL,
    "EncryptedContext" text                     NOT NULL DEFAULT '',
    "EncryptedResult"  text                     NOT NULL,
    "TotalTokens"      integer                  NOT NULL DEFAULT 0,
    "CreatedAt"        timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_AiAnalysisHistories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AiAnalysisHistories_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_AiAnalysisHistories_Chapters_ChapterId" FOREIGN KEY ("ChapterId")
        REFERENCES "Chapters" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_AiAnalysisHistories_Users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_AiAnalysisHistories_ProjectId_UserId" ON "AiAnalysisHistories" ("ProjectId", "UserId");
CREATE INDEX "IX_AiAnalysisHistories_ChapterId"        ON "AiAnalysisHistories" ("ChapterId");
CREATE INDEX "IX_AiAnalysisHistories_AnalysisType"     ON "AiAnalysisHistories" ("AnalysisType");

-- ────────────────────────────────────────────────────────────
-- BugReports table
-- ────────────────────────────────────────────────────────────
CREATE TABLE "BugReports" (
    "Id"           uuid         NOT NULL DEFAULT uuid_generate_v4(),
    "UserId"       uuid         NOT NULL,
    "Title"        varchar(200) NOT NULL,
    "Description"  text         NOT NULL,
    "Category"     varchar(30)  NOT NULL DEFAULT 'Bug',
    "Priority"     varchar(20)  NOT NULL DEFAULT 'Medium',
    "Status"       varchar(20)  NOT NULL DEFAULT 'Open',
    "StaffNote"    varchar(1000),
    "ResolvedById" uuid,
    "CreatedAt"    timestamptz  NOT NULL DEFAULT NOW(),
    "UpdatedAt"    timestamptz,
    CONSTRAINT "PK_BugReports" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_BugReports_Category" CHECK ("Category" IN ('Bug','UX','Feature','Other')),
    CONSTRAINT "CK_BugReports_Priority" CHECK ("Priority" IN ('Low','Medium','High')),
    CONSTRAINT "CK_BugReports_Status"   CHECK ("Status"   IN ('Open','InProgress','Resolved','Closed')),
    CONSTRAINT "FK_BugReports_Users_UserId"       FOREIGN KEY ("UserId")       REFERENCES "Users"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BugReports_Users_ResolvedById" FOREIGN KEY ("ResolvedById") REFERENCES "Users"("Id") ON DELETE SET NULL
);
CREATE INDEX "IX_BugReports_Status" ON "BugReports" ("Status");
CREATE INDEX "IX_BugReports_UserId" ON "BugReports" ("UserId");

-- ────────────────────────────────────────────────────────────
-- StaffFeedbacks table
-- ────────────────────────────────────────────────────────────
CREATE TABLE "StaffFeedbacks" (
    "Id"        uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "ProjectId" uuid                     NOT NULL,
    "ProjectReportId" uuid,
    "ChapterId" uuid,
    "AuthorId"  uuid                     NOT NULL,
    "StaffId"   uuid                     NOT NULL,
    "Content"   character varying(3000)  NOT NULL,
    "Status"    character varying(20)    NOT NULL DEFAULT 'Open',
    "StaffNote" character varying(3000),
    "UserReaction" character varying(20),
    "UserFeedback" character varying(3000),
    "UserRespondedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone,
    "ReadAt"    timestamp with time zone,
    CONSTRAINT "PK_StaffFeedbacks" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_StaffFeedback_Status" CHECK ("Status" IN ('Open','Resolved')),
    CONSTRAINT "FK_StaffFeedbacks_ProjectReports_ProjectReportId" FOREIGN KEY ("ProjectReportId")
        REFERENCES "ProjectReports" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StaffFeedbacks_Chapters_ChapterId" FOREIGN KEY ("ChapterId")
        REFERENCES "Chapters" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_StaffFeedbacks_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StaffFeedbacks_Users_AuthorId" FOREIGN KEY ("AuthorId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StaffFeedbacks_Users_StaffId" FOREIGN KEY ("StaffId")
        REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_StaffFeedbacks_AuthorId" ON "StaffFeedbacks" ("AuthorId");
CREATE INDEX "IX_StaffFeedbacks_ChapterId" ON "StaffFeedbacks" ("ChapterId");
CREATE INDEX "IX_StaffFeedbacks_ProjectReportId" ON "StaffFeedbacks" ("ProjectReportId");
CREATE INDEX "IX_StaffFeedbacks_ProjectId" ON "StaffFeedbacks" ("ProjectId");
CREATE INDEX "IX_StaffFeedbacks_StaffId" ON "StaffFeedbacks" ("StaffId");
CREATE INDEX "IX_StaffFeedbacks_UserReaction" ON "StaffFeedbacks" ("UserReaction");

-- StaffKnowledgeBaseItems: đã thay bằng faqs + writing_tips (xem upsert_help_content.sql)

-- ────────────────────────────────────────────────────────────
-- StaffAnalysisReviews table
-- ────────────────────────────────────────────────────────────
CREATE TABLE "StaffAnalysisReviews" (
    "Id"              uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "ProjectReportId" uuid                     NOT NULL,
    "ProjectId"       uuid                     NOT NULL,
    "AuthorId"        uuid                     NOT NULL,
    "ReviewedBy"      uuid                     NOT NULL,
    "Action"          character varying(20)    NOT NULL DEFAULT 'Verified',
    "Note"            character varying(2000),
    "RerunReportId"   uuid,
    "CreatedAt"       timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt"       timestamp with time zone,
    CONSTRAINT "PK_StaffAnalysisReviews" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_StaffAnalysisReview_Action" CHECK ("Action" IN ('Verified','Adjusted','RerunRequested')),
    CONSTRAINT "FK_StaffAnalysisReviews_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StaffAnalysisReviews_ProjectReports_ProjectReportId" FOREIGN KEY ("ProjectReportId")
        REFERENCES "ProjectReports" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StaffAnalysisReviews_ProjectReports_RerunReportId" FOREIGN KEY ("RerunReportId")
        REFERENCES "ProjectReports" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_StaffAnalysisReviews_Users_AuthorId" FOREIGN KEY ("AuthorId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StaffAnalysisReviews_Users_ReviewedBy" FOREIGN KEY ("ReviewedBy")
        REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_StaffAnalysisReviews_AuthorId" ON "StaffAnalysisReviews" ("AuthorId");
CREATE INDEX "IX_StaffAnalysisReviews_ProjectId" ON "StaffAnalysisReviews" ("ProjectId");
CREATE UNIQUE INDEX "IX_StaffAnalysisReviews_ProjectReportId" ON "StaffAnalysisReviews" ("ProjectReportId");
CREATE INDEX "IX_StaffAnalysisReviews_RerunReportId" ON "StaffAnalysisReviews" ("RerunReportId");
CREATE INDEX "IX_StaffAnalysisReviews_ReviewedBy" ON "StaffAnalysisReviews" ("ReviewedBy");

-- ────────────────────────────────────────────────────────────
-- Payments table
-- ────────────────────────────────────────────────────────────
CREATE TABLE "Payments" (
    "Id"             uuid                     NOT NULL DEFAULT (uuid_generate_v4()),
    "UserId"         uuid                     NOT NULL,
    "SubscriptionId" integer                  NULL,
    "PlanId"         integer                  NOT NULL,
    "Amount"         numeric(18,2)            NOT NULL,
    "Currency"       character varying(10)    NOT NULL DEFAULT 'VND',
    "PaymentMethod"  character varying(50)    NOT NULL DEFAULT 'Card',
    "Status"         character varying(20)    NOT NULL DEFAULT 'Pending',
    "TransactionId"  character varying(255)   NULL,
    "Description"    text                     NULL,
    "PaidAt"         timestamp with time zone NULL,
    "RefundedAt"     timestamp with time zone NULL,
    "CreatedAt"      timestamp with time zone NOT NULL DEFAULT (NOW()),
    "UpdatedAt"      timestamp with time zone NULL,
    CONSTRAINT "PK_Payments" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Payment_Status"
        CHECK ("Status" IN ('Pending','Completed','Failed','Refunded','Cancelled')),
    CONSTRAINT "FK_Payments_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Payments_SubscriptionPlans_PlanId"
        FOREIGN KEY ("PlanId") REFERENCES "SubscriptionPlans" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Payments_UserSubscriptions_SubscriptionId"
        FOREIGN KEY ("SubscriptionId") REFERENCES "UserSubscriptions" ("Id") ON DELETE SET NULL
);

CREATE INDEX        "IX_Payments_UserId"         ON "Payments" ("UserId");
CREATE INDEX        "IX_Payments_PlanId"         ON "Payments" ("PlanId");
CREATE INDEX        "IX_Payments_SubscriptionId" ON "Payments" ("SubscriptionId");
CREATE UNIQUE INDEX "IX_Payments_TransactionId"  ON "Payments" ("TransactionId") WHERE "TransactionId" IS NOT NULL;
CREATE INDEX        "IX_Payments_Status"         ON "Payments" ("Status");
CREATE INDEX        "IX_Payments_CreatedAt"      ON "Payments" ("CreatedAt" DESC);

-- ── character_relationships ───────────────────────────────────
CREATE TABLE "character_relationships" (
    "Id"               uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "ProjectId"        uuid                     NOT NULL,
    "CharAId"          uuid                     NOT NULL,
    "CharBId"          uuid                     NOT NULL,
    "RelationType"     character varying(50)    NOT NULL DEFAULT 'Other',
    "StrengthScore"    real                     NOT NULL DEFAULT 0,
    "EvidenceChunkIds" jsonb,
    "CreatedAt"        timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_character_relationships" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_CharacterRelationships_CharOrder" CHECK ("CharAId" < "CharBId"),
    CONSTRAINT "FK_character_relationships_Projects_ProjectId" FOREIGN KEY ("ProjectId")
        REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_character_relationships_CharacterEntries_CharAId" FOREIGN KEY ("CharAId")
        REFERENCES "CharacterEntries" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_character_relationships_CharacterEntries_CharBId" FOREIGN KEY ("CharBId")
        REFERENCES "CharacterEntries" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_character_relationships_ProjectId" ON "character_relationships" ("ProjectId");
CREATE INDEX "IX_character_relationships_CharAId"   ON "character_relationships" ("CharAId");
CREATE INDEX "IX_character_relationships_CharBId"   ON "character_relationships" ("CharBId");
CREATE UNIQUE INDEX "IX_character_relationships_ProjectId_CharAId_CharBId"
    ON "character_relationships" ("ProjectId", "CharAId", "CharBId");

-- ── analysis_job_rerun_audits ─────────────────────────────────
CREATE TABLE "analysis_job_rerun_audits" (
    "Id"        uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "OldJobId"  uuid                     NOT NULL,
    "NewJobId"  uuid                     NOT NULL,
    "StaffId"   uuid                     NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_analysis_job_rerun_audits" PRIMARY KEY ("Id")
);

CREATE INDEX        "IX_analysis_job_rerun_audits_OldJobId"  ON "analysis_job_rerun_audits" ("OldJobId");
CREATE UNIQUE INDEX "IX_analysis_job_rerun_audits_NewJobId"  ON "analysis_job_rerun_audits" ("NewJobId");
CREATE INDEX        "IX_analysis_job_rerun_audits_StaffId"   ON "analysis_job_rerun_audits" ("StaffId");
CREATE INDEX        "IX_analysis_job_rerun_audits_CreatedAt" ON "analysis_job_rerun_audits" ("CreatedAt");

-- ── system_config ─────────────────────────────────────────────
CREATE TABLE "system_config" (
    "Key"       character varying(200) NOT NULL,
    "Value"     jsonb                  NOT NULL DEFAULT 'null',
    "UpdatedBy" uuid,
    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_system_config" PRIMARY KEY ("Key"),
    CONSTRAINT "FK_system_config_Users_UpdatedBy" FOREIGN KEY ("UpdatedBy")
        REFERENCES "Users" ("Id") ON DELETE SET NULL
);

CREATE INDEX "IX_system_config_UpdatedBy" ON "system_config" ("UpdatedBy");

-- ── faqs ──────────────────────────────────────────────────────
CREATE TABLE "faqs" (
    "Id"        uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "Question"  character varying(300)   NOT NULL,
    "Answer"    character varying(5000)  NOT NULL,
    "Category"  character varying(50)    NOT NULL DEFAULT 'General',
    "Order"     integer                  NOT NULL DEFAULT 0,
    "Published" boolean                  NOT NULL DEFAULT FALSE,
    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_faqs" PRIMARY KEY ("Id")
);

CREATE INDEX "IX_faqs_Category_Published_Order" ON "faqs" ("Category", "Published", "Order");
CREATE INDEX "IX_faqs_UpdatedAt"                ON "faqs" ("UpdatedAt");

-- ── writing_tips ──────────────────────────────────────────────
CREATE TABLE "writing_tips" (
    "Id"        uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    "Title"     character varying(200)   NOT NULL,
    "Content"   character varying(8000)  NOT NULL,
    "Tags"      text[]                   NOT NULL DEFAULT '{}'::text[],
    "Published" boolean                  NOT NULL DEFAULT FALSE,
    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_writing_tips" PRIMARY KEY ("Id")
);

CREATE INDEX "IX_writing_tips_Published" ON "writing_tips" ("Published");
CREATE INDEX "IX_writing_tips_UpdatedAt" ON "writing_tips" ("UpdatedAt");
CREATE INDEX "IX_writing_tips_Tags_gin"  ON "writing_tips" USING GIN ("Tags");

-- ────────────────────────────────────────────────────────────
-- BƯỚC 5: SEED DATA
-- ────────────────────────────────────────────────────────────

-- Subscription Plans
INSERT INTO "SubscriptionPlans" ("Id","PlanName","Price","MaxAnalysisCount","MaxTokenLimit","Description","IsActive") VALUES
    (1, 'Free',       0,       3,    20000,   'Gói miễn phí – 3 lần phân tích bộ truyện và 20,000 token AI mỗi tháng.',         TRUE),
    (2, 'Basic',      99000,   20,   150000,  'Gói cơ bản – 99,000đ/tháng. 20 lần phân tích và 150,000 token AI.',              TRUE),
    (3, 'Pro',        249000,  100,  500000,  'Gói chuyên nghiệp – 249,000đ/tháng. 100 lần phân tích và 500,000 token AI.',     TRUE),
    (4, 'Enterprise', 699000,  9999, 2000000, 'Gói doanh nghiệp – 699,000đ/tháng. Không giới hạn phân tích và 2,000,000 token AI.', TRUE);

-- Reset sequence sau khi insert tường minh
SELECT setval(pg_get_serial_sequence('"SubscriptionPlans"', 'Id'), 4);

-- Genres
INSERT INTO "Genres" ("Id","Name","Slug","Color","Description") VALUES
    (1,  'Hành động',           'hanh-dong',            '#EF4444', 'Xung đột cao, tiết tấu nhanh, nhiều pha đối đầu'),
    (2,  'Phiêu lưu',           'phieu-luu',            '#F59E0B', 'Hành trình khám phá vùng đất, thử thách hoặc bí ẩn mới'),
    (3,  'Lãng mạn',            'lang-man',             '#EC4899', 'Tập trung vào mối quan hệ tình cảm và phát triển cảm xúc'),
    (4,  'Tâm lý xã hội',       'tam-ly-xa-hoi',        '#64748B', 'Đào sâu nội tâm nhân vật, mâu thuẫn xã hội và đời sống'),
    (5,  'Trinh thám',          'trinh-tham',           '#334155', 'Điều tra vụ án, suy luận manh mối và lật mở sự thật'),
    (6,  'Kinh dị',             'kinh-di',              '#111827', 'Không khí u ám, căng thẳng, yếu tố rùng rợn hoặc siêu nhiên'),
    (7,  'Khoa học viễn tưởng', 'khoa-hoc-vien-tuong',  '#2563EB', 'Công nghệ, vũ trụ, tương lai hoặc giả thuyết khoa học'),
    (8,  'Huyền huyễn',         'huyen-huyen',          '#8B5CF6', 'Thế giới giả tưởng, phép thuật, chủng tộc và hệ thống sức mạnh'),
    (9,  'Kiếm hiệp',           'kiem-hiep',            '#B91C1C', 'Giang hồ, môn phái, võ học và ân oán'),
    (10, 'Tiên hiệp',           'tien-hiep',            '#0EA5E9', 'Tu luyện, cảnh giới, linh căn và hành trình thành tiên'),
    (11, 'Lịch sử',             'lich-su',              '#92400E', 'Bối cảnh thời đại lịch sử, nhân vật và biến cố theo thời kỳ'),
    (12, 'Đô thị hiện đại',     'do-thi-hien-dai',      '#0D9488', 'Câu chuyện diễn ra trong đời sống hiện đại, nhịp sống thành thị'),
    (13, 'Xuyên không',         'xuyen-khong',          '#7C3AED', 'Du hành thời gian, chuyển sinh hoặc dịch chuyển giữa các thế giới'),
    (14, 'Hài hước',            'hai-huoc',             '#22C55E', 'Giọng kể nhẹ nhàng, châm biếm, tạo tiếng cười');

SELECT setval(pg_get_serial_sequence('"Genres"', 'Id'), 14);

-- FAQs & Writing Tips (chạy Scripts/upsert_help_content.sql sau reset, hoặc dùng EF migration UpsertHelpContent)

-- system_logs (admin audit)
CREATE TABLE IF NOT EXISTS system_logs (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Level" character varying(20) NOT NULL,
    "Category" character varying(50) NOT NULL,
    "Action" character varying(100) NOT NULL,
    "Message" character varying(1000) NOT NULL,
    "ActorId" uuid NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    "MetadataJson" jsonb NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "IX_system_logs_CreatedAt" ON system_logs ("CreatedAt");
CREATE INDEX IF NOT EXISTS "IX_system_logs_Category" ON system_logs ("Category");

-- ────────────────────────────────────────────────────────────
-- BƯỚC 6: GHI EF MIGRATIONS HISTORY
-- (EF sẽ không chạy lại các migration này)
-- ────────────────────────────────────────────────────────────

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES
    ('20260313061741_InitialCreate', '9.0.0'),
    ('20260313072231_AddContextTables', '9.0.0'),
    ('20260323015637_AddTimelineEvents', '9.0.0'),
    ('20260324071856_AddProjectVersionToReport', '9.0.0'),
    ('20260407014557_AddAiAnalysisHistory', '9.0.0'),
    ('20260411063213_AddProjectAnalysisJobs', '9.0.0'),
    ('20260413072432_EnforceSingleActiveAnalysisJob', '9.0.0'),
    ('20260413163500_AddStaffFunctions', '9.0.0'),
    ('20260415083200_EnsureStaffFeedbackTable', '9.0.0'),
    ('20260415084500_EnsureStaffKnowledgeAndReviewTables', '9.0.0'),
    ('20260422192758_AddActionTypeToRewriteHistory', '9.0.0'),
    ('20260428181448_AddPasswordFormatVersion', '9.0.0'),
    ('20260503030041_AddProjectAnalysisFact', '9.0.0'),
    ('20260503031424_AddReportItemEvidenceChunkIds', '9.0.0'),
    ('20260503060214_AddSystemConfig', '9.0.0'),
    ('20260504165836_AddProjectAbuseFlags', '9.0.0'),
    ('20260505183000_AddStaffFeedbackReadAt', '9.0.0'),
    ('20260508003000_EnsureFaqsTable', '9.0.0'),
    ('20260508004000_EnsureWritingTipsTable', '9.0.0'),
    ('20260508005500_AddAnalysisJobRerunAudit', '9.0.0'),
    ('20260508134500_AddCharacterRelationships', '9.0.0'),
    ('20260513231800_AddStaffFeedbackResponseFields', '9.0.0'),
    ('20260514104000_AddNotifications', '9.0.0'),
    ('20260519150000_SeedHelpContent', '9.0.0'),
    ('20260520120000_UpsertHelpContent', '9.0.0'),
    ('20260520140000_DropStaffKnowledgeBaseItems', '9.0.0');
