using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class RemoveManualStoryBibleTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "character_relationships");

            migrationBuilder.DropTable(
                name: "PlotNoteEntries");

            migrationBuilder.DropTable(
                name: "StyleGuideEntries");

            migrationBuilder.DropTable(
                name: "ThemeEntries");

            migrationBuilder.DropTable(
                name: "TimelineEvents");

            migrationBuilder.DropTable(
                name: "WorldbuildingEntries");

            migrationBuilder.DropTable(
                name: "CharacterEntries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CharacterEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Background = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    Embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Supporting"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CharacterEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CharacterEntries_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlotNoteEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Other"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlotNoteEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlotNoteEntries_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StyleGuideEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Aspect = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Other"),
                    Content = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StyleGuideEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StyleGuideEntries_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThemeEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    Embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThemeEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThemeEntries_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TimelineEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Story"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    Importance = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Normal"),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    TimeLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimelineEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TimelineEvents_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorldbuildingEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Other"),
                    Content = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorldbuildingEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorldbuildingEntries_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "character_relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    CharAId = table.Column<Guid>(type: "uuid", nullable: false),
                    CharBId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    EvidenceChunkIds = table.Column<string>(type: "jsonb", nullable: true),
                    RelationType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Other"),
                    StrengthScore = table.Column<float>(type: "real", nullable: false, defaultValue: 0f)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_relationships", x => x.Id);
                    table.CheckConstraint("CK_CharacterRelationships_CharOrder", "\"CharAId\" < \"CharBId\"");
                    table.ForeignKey(
                        name: "FK_character_relationships_CharacterEntries_CharAId",
                        column: x => x.CharAId,
                        principalTable: "CharacterEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_character_relationships_CharacterEntries_CharBId",
                        column: x => x.CharBId,
                        principalTable: "CharacterEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_character_relationships_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_CharAId",
                table: "character_relationships",
                column: "CharAId");

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_CharBId",
                table: "character_relationships",
                column: "CharBId");

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_ProjectId",
                table: "character_relationships",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_ProjectId_CharAId_CharBId",
                table: "character_relationships",
                columns: new[] { "ProjectId", "CharAId", "CharBId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CharacterEntries_ProjectId",
                table: "CharacterEntries",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_PlotNoteEntries_ProjectId",
                table: "PlotNoteEntries",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_StyleGuideEntries_ProjectId",
                table: "StyleGuideEntries",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ThemeEntries_ProjectId",
                table: "ThemeEntries",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_TimelineEvents_ProjectId_SortOrder",
                table: "TimelineEvents",
                columns: new[] { "ProjectId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_WorldbuildingEntries_ProjectId",
                table: "WorldbuildingEntries",
                column: "ProjectId");
        }
    }
}
