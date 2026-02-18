using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="SentNotification"/> entity.
/// </summary>
internal sealed class SentNotificationConfiguration : IEntityTypeConfiguration<SentNotification>
{
    public void Configure(EntityTypeBuilder<SentNotification> builder)
    {
        builder.ToTable("SentNotifications");

        builder.HasKey(sn => sn.Id);

        builder.Property(sn => sn.Id)
            .ValueGeneratedOnAdd();

        builder.Property(sn => sn.RecipientId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(sn => sn.RecipientType)
            .IsRequired()
            .HasMaxLength(10);

        builder.Property(sn => sn.ConversationId)
            .HasMaxLength(500);

        builder.Property(sn => sn.ServiceUrl)
            .HasMaxLength(500);

        builder.Property(sn => sn.DeliveryStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(sn => sn.ErrorMessage)
            .HasMaxLength(1000);

        // CHECK constraint ensuring only known delivery status values are stored.
        builder.ToTable(t => t.HasCheckConstraint(
            "CK_SentNotifications_DeliveryStatus",
            "[DeliveryStatus] IN ('Queued','Succeeded','Failed','RecipientNotFound','Retrying')"));

        // Unique constraint: a recipient should appear only once per notification.
        builder.HasIndex(sn => new { sn.NotificationId, sn.RecipientId })
            .IsUnique()
            .HasDatabaseName("UX_SentNotifications_NotificationId_RecipientId");

        // Covering index optimised for aggregation queries (counting by status)
        // that also need SentDate and StatusCode. The INCLUDE columns are defined
        // via HasInclude so they live in the leaf pages without participating in
        // the index key.
        builder.HasIndex(sn => new { sn.NotificationId, sn.DeliveryStatus })
            .HasDatabaseName("IX_SentNotifications_NotificationId_DeliveryStatus")
            .IncludeProperties(sn => new { sn.SentDate, sn.StatusCode });
    }
}
