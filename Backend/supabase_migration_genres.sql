-- ============================================================
-- Migration: AddGenres
-- Tạo bảng Genres + ProjectGenres, seed 14 thể loại
-- Applied: Run this on Supabase SQL Editor
-- ============================================================

-- 1. Tạo bảng Genres
CREATE TABLE IF NOT EXISTS "Genres" (
    "Id"          SERIAL PRIMARY KEY,
    "Name"        VARCHAR(100) NOT NULL,
    "Slug"        VARCHAR(100) NOT NULL,
    "Color"       VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
    "Description" VARCHAR(500)
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Genres_Slug" ON "Genres" ("Slug");

-- 2. Tạo bảng ProjectGenres (join)
CREATE TABLE IF NOT EXISTS "ProjectGenres" (
    "ProjectId" UUID NOT NULL REFERENCES "Projects" ("Id") ON DELETE CASCADE,
    "GenreId"   INT  NOT NULL REFERENCES "Genres"   ("Id") ON DELETE CASCADE,
    PRIMARY KEY ("ProjectId", "GenreId")
);

CREATE INDEX IF NOT EXISTS "IX_ProjectGenres_GenreId" ON "ProjectGenres" ("GenreId");

-- 3. Seed 14 thể loại
INSERT INTO "Genres" ("Id", "Name", "Slug", "Color", "Description") VALUES
    (1,  'Tiểu thuyết',          'tieu-thuyet',          '#6366f1', 'Tác phẩm văn xuôi dài'),
    (2,  'Ngắn truyện',          'ngan-truyen',           '#8b5cf6', 'Truyện ngắn, truyện vừa'),
    (3,  'Kiếm hiệp',            'kiem-hiep',             '#ef4444', 'Võ hiệp, kiếm khách'),
    (4,  'Tiên hiệp',            'tien-hiep',             '#f59e0b', 'Tu tiên, luyện khí'),
    (5,  'Huyền huyễn',          'huyen-huyen',           '#10b981', 'Fantasy, thế giới ảo'),
    (6,  'Khoa học viễn tưởng',  'khoa-hoc-vien-tuong',  '#3b82f6', 'Sci-Fi, tương lai'),
    (7,  'Lãng mạn',             'lang-man',              '#ec4899', 'Tình cảm, lãng mạn'),
    (8,  'Trinh thám',           'trinh-tham',            '#64748b', 'Điều tra, phá án'),
    (9,  'Kinh dị',              'kinh-di',               '#dc2626', 'Horror, ma quái'),
    (10, 'Lịch sử',              'lich-su',               '#92400e', 'Bối cảnh lịch sử'),
    (11, 'Đô thị',               'do-thi',                '#0891b2', 'Cuộc sống hiện đại'),
    (12, 'Xuyên không',          'xuyen-khong',           '#7c3aed', 'Isekai, xuyên thời gian'),
    (13, 'Hệ thống',             'he-thong',              '#059669', 'LitRPG, hệ thống cấp bậc'),
    (14, 'Gia đình',             'gia-dinh',              '#d97706', 'Tình cảm gia đình')
ON CONFLICT ("Id") DO NOTHING;

-- Reset sequence sau khi insert với id tường minh
SELECT setval(pg_get_serial_sequence('"Genres"', 'Id'), 14);
