using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260508134500_AddCharacterRelationships")]
    public partial class AddCharacterRelationships : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "character_relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CharAId = table.Column<Guid>(type: "uuid", nullable: false),
                    CharBId = table.Column<Guid>(type: "uuid", nullable: false),
                    RelationType = table.Column<string>(type: "character varying(50)", nullable: false, defaultValue: "Other"),
                    StrengthScore = table.Column<float>(type: "real", nullable: false, defaultValue: 0f),
                    EvidenceChunkIds = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_relationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_character_relationships_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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
                });

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_ProjectId",
                table: "character_relationships",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_CharAId",
                table: "character_relationships",
                column: "CharAId");

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_CharBId",
                table: "character_relationships",
                column: "CharBId");

            migrationBuilder.CreateIndex(
                name: "IX_character_relationships_ProjectId_CharAId_CharBId",
                table: "character_relationships",
                columns: new[] { "ProjectId", "CharAId", "CharBId" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_CharacterRelationships_CharOrder",
                table: "character_relationships",
                sql: "\"CharAId\" < \"CharBId\"");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "character_relationships");
        }
    }
}

