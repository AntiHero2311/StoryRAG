-- Chạy trên Supabase nếu chưa dotnet ef database update (sau khi restart API)
DROP TABLE IF EXISTS "AuthorAppeals";
DROP TABLE IF EXISTS "SupportTickets";

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260519120000_RemoveSupportTicketsAndAppeals', '9.0.0'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260519120000_RemoveSupportTicketsAndAppeals'
);
