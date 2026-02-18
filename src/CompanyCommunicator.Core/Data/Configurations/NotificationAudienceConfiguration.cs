using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="NotificationAudience"/> entity.
/// </summary>
internal sealed class NotificationAudienceConfiguration : IEntityTypeConfiguration<NotificationAudience>
{
    public void Configure(EntityTypeBuilder<NotificationAudience> builder)
    {
        builder.ToTable("NotificationAudiences");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .ValueGeneratedOnAdd();

        builder.Property(a => a.AudienceType)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(a => a.AudienceId)
            .IsRequired()
            .HasMaxLength(200);

        // CHECK constraint ensuring only known audience type values are stored.
        builder.ToTable(t => t.HasCheckConstraint(
            "CK_NotificationAudiences_AudienceType",
            "[AudienceType] IN ('Team','Roster','Group')"));

        // Index to support efficient lookup of all audiences for a given notification.
        builder.HasIndex(a => a.NotificationId)
            .HasDatabaseName("IX_NotificationAudiences_NotificationId");
    }
}
