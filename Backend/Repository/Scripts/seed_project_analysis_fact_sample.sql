-- Mẫu chèn một dòng ProjectAnalysisFacts (payload JSON đúng schema cấp 1).
-- Điều kiện: đã có ít nhất một bản ghi trong "ProjectAnalysisJobs".
-- Chạy trên PostgreSQL sau khi áp dụng migration AddProjectAnalysisFact.

INSERT INTO "ProjectAnalysisFacts" ("Id", "ProjectId", "RunId", "Payload", "CreatedAt")
SELECT
    uuid_generate_v4(),
    j."ProjectId",
    j."Id",
    jsonb_build_object(
        'characters', jsonb_build_array(
            jsonb_build_object('name', 'Nhân vật A', 'role', 'Protagonist')
        ),
        'chapter_stats', jsonb_build_array(
            jsonb_build_object('chapterNumber', 1, 'wordCount', 1200)
        ),
        'plot_events', jsonb_build_array(
            jsonb_build_object('summary', 'Sự kiện mở đầu', 'chapterNumber', 1)
        ),
        'consistency_flags', jsonb_build_array(
            jsonb_build_object('code', 'WARN_TONE', 'detail', 'Ví dụ cờ nhất quán')
        )
    ),
    NOW()
FROM "ProjectAnalysisJobs" AS j
ORDER BY j."CreatedAt" DESC
LIMIT 1;
