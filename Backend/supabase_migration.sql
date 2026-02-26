CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "Users" (
    "Id" uuid NOT NULL DEFAULT (uuid_generate_v4()),
    "FullName" character varying(100) NOT NULL,
    "Email" character varying(100) NOT NULL,
    "PasswordHash" text NOT NULL,
    "PasswordSalt" text NOT NULL,
    "AvatarURL" character varying(500),
    "Role" character varying(20) NOT NULL,
    "IsActive" boolean NOT NULL DEFAULT TRUE,
    "DataEncryptionKey" text,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (NOW()),
    "RefreshToken" text,
    "RefreshTokenExpiryTime" timestamp with time zone,
    "PasswordResetToken" text,
    "PasswordResetTokenExpiryTime" timestamp with time zone,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Users_Role" CHECK ("Role" IN ('Admin','Author','Staff'))
);

CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260224203002_InitialCreate', '9.0.2');

COMMIT;

-- ============================================================
-- Migration: AddProjectsTable
-- ============================================================

START TRANSACTION;

CREATE TABLE "Projects" (
    "Id" uuid NOT NULL DEFAULT (uuid_generate_v4()),
    "AuthorId" uuid NOT NULL,
    "EncryptedTitle" text NOT NULL,
    "EncryptedSummary" text,
    "CoverImageURL" character varying(500),
    "Status" character varying(20) NOT NULL DEFAULT 'Draft',
    "IsDeleted" boolean NOT NULL DEFAULT FALSE,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (NOW()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Projects" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Projects_Status" CHECK ("Status" IN ('Draft','Published','Archived')),
    CONSTRAINT "FK_Projects_Users_AuthorId" FOREIGN KEY ("AuthorId")
        REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_Projects_AuthorId" ON "Projects" ("AuthorId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260225094534_AddProjectsTable', '9.0.2');

COMMIT;
