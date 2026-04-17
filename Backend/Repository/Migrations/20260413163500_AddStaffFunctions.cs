using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffFunctions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StaffKnowledgeBaseItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "FAQ"),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    Tags = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffKnowledgeBaseItems", x => x.Id);
                    table.CheckConstraint("CK_StaffKnowledgeBaseItems_Type", "\"Type\" IN ('FAQ','WritingTip')");
                    table.ForeignKey(
                        name: "FK_StaffKnowledgeBaseItems_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffKnowledgeBaseItems_Users_UpdatedBy",
                        column: x => x.UpdatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "StaffFeedbacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChapterId = table.Column<Guid>(type: "uuid", nullable: true),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Open"),
                    StaffNote = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffFeedbacks", x => x.Id);
                    table.CheckConstraint("CK_StaffFeedback_Status", "\"Status\" IN ('Open','Resolved')");
                    table.ForeignKey(
                        name: "FK_StaffFeedbacks_Chapters_ChapterId",
                        column: x => x.ChapterId,
                        principalTable: "Chapters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StaffFeedbacks_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffFeedbacks_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffFeedbacks_Users_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StaffAnalysisReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Verified"),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    RerunReportId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffAnalysisReviews", x => x.Id);
                    table.CheckConstraint("CK_StaffAnalysisReview_Action", "\"Action\" IN ('Verified','Adjusted','RerunRequested')");
                    table.ForeignKey(
                        name: "FK_StaffAnalysisReviews_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffAnalysisReviews_ProjectReports_ProjectReportId",
                        column: x => x.ProjectReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffAnalysisReviews_ProjectReports_RerunReportId",
                        column: x => x.RerunReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StaffAnalysisReviews_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffAnalysisReviews_Users_ReviewedBy",
                        column: x => x.ReviewedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnalysisReviews_AuthorId",
                table: "StaffAnalysisReviews",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnalysisReviews_ProjectId",
                table: "StaffAnalysisReviews",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnalysisReviews_ProjectReportId",
                table: "StaffAnalysisReviews",
                column: "ProjectReportId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnalysisReviews_RerunReportId",
                table: "StaffAnalysisReviews",
                column: "RerunReportId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnalysisReviews_ReviewedBy",
                table: "StaffAnalysisReviews",
                column: "ReviewedBy");

            migrationBuilder.CreateIndex(
                name: "IX_StaffFeedbacks_AuthorId",
                table: "StaffFeedbacks",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffFeedbacks_ChapterId",
                table: "StaffFeedbacks",
                column: "ChapterId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffFeedbacks_ProjectId",
                table: "StaffFeedbacks",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffFeedbacks_StaffId",
                table: "StaffFeedbacks",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffKnowledgeBaseItems_CreatedBy",
                table: "StaffKnowledgeBaseItems",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_StaffKnowledgeBaseItems_Type_IsPublished_SortOrder",
                table: "StaffKnowledgeBaseItems",
                columns: new[] { "Type", "IsPublished", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffKnowledgeBaseItems_UpdatedBy",
                table: "StaffKnowledgeBaseItems",
                column: "UpdatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StaffAnalysisReviews");

            migrationBuilder.DropTable(
                name: "StaffFeedbacks");

            migrationBuilder.DropTable(
                name: "StaffKnowledgeBaseItems");
        }
    }
}
