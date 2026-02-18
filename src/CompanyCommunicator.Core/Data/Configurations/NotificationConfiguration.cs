using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="Notification"/> entity.
/// </summary>
internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");

        builder.HasKey(n => n.Id);

        // Default the PK to NEWSEQUENTIALID() so EF-generated inserts get a sequential GUID
        // (better index fragmentation than NEWID()).
        builder.Property(n => n.Id)
            .HasDefaultValueSql("NEWSEQUENTIALID()");

        builder.Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(n => n.Summary)
            .HasMaxLength(4000);

        builder.Property(n => n.ImageLink)
            .HasMaxLength(1000);

        builder.Property(n => n.ImageBlobName)
            .HasMaxLength(200);

        builder.Property(n => n.ButtonTitle)
            .HasMaxLength(200);

        builder.Property(n => n.ButtonLink)
            .HasMaxLength(1000);

        builder.Property(n => n.Author)
            .HasMaxLength(200);

        builder.Property(n => n.CreatedBy)
            .HasMaxLength(200);

        builder.Property(n => n.CreatedDate)
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(n => n.Status)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(n => n.TrackingUrl)
            .HasMaxLength(1000);

        // CHECK constraint ensuring only known status values are stored.
        builder.ToTable(t => t.HasCheckConstraint(
            "CK_Notifications_Status",
            "[Status] IN ('Draft','Scheduled','Queued','SyncingRecipients','InstallingApp','Sending','Sent','Canceled','Failed')"));

        // Cascade-delete audiences and sent notifications when a notification is deleted.
        builder.HasMany(n => n.Audiences)
            .WithOne(a => a.Notification)
            .HasForeignKey(a => a.NotificationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(n => n.SentNotifications)
            .WithOne(sn => sn.Notification)
            .HasForeignKey(sn => sn.NotificationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(n => n.ExportJobs)
            .WithOne(ej => ej.Notification)
            .HasForeignKey(ej => ej.NotificationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
