using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CompanyCommunicator.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInstallLookupIndexAndTeamAadGroupId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AadGroupId",
                table: "Teams",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Teams_AadGroupId",
                table: "Teams",
                column: "AadGroupId",
                unique: true,
                filter: "[AadGroupId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SentNotifications_Install_Lookup_User",
                table: "SentNotifications",
                columns: new[] { "NotificationId", "Id" },
                filter: "[ConversationId] IS NULL AND [DeliveryStatus] = 'Queued' AND [RecipientType] = 'User'")
                .Annotation("SqlServer:Include", new[] { "RecipientId", "ServiceUrl" });

            // Team-scope filtered index added via raw SQL because its key columns
            // (NotificationId, DeliveryStatus) conflict with the existing aggregation index.
            // EF Core can't model two indexes with the same key columns.
            migrationBuilder.Sql(@"
                CREATE INDEX [IX_SentNotifications_Install_Lookup_Team]
                ON [SentNotifications] ([NotificationId], [DeliveryStatus])
                INCLUDE ([RecipientId], [ServiceUrl])
                WHERE [ConversationId] IS NULL AND [RecipientType] = 'Team';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Teams_AadGroupId",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_SentNotifications_Install_Lookup_User",
                table: "SentNotifications");

            migrationBuilder.DropIndex(
                name: "IX_SentNotifications_Install_Lookup_Team",
                table: "SentNotifications");

            migrationBuilder.DropColumn(
                name: "AadGroupId",
                table: "Teams");
        }
    }
}
