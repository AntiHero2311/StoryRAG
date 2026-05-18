-- Chạy trên Supabase SQL Editor nếu chưa dotnet ef database update
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
CREATE INDEX IF NOT EXISTS "IX_system_logs_ActorId" ON system_logs ("ActorId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260514120000_AddSystemLogs', '9.0.0'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260514120000_AddSystemLogs'
);
