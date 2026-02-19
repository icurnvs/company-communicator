using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="Team"/> entity.
/// </summary>
internal sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.ToTable("Teams");

        builder.HasKey(t => t.TeamId);

        builder.Property(t => t.TeamId)
            .IsRequired()
            .HasMaxLength(200)
            .ValueGeneratedNever();

        builder.Property(t => t.Name)
            .HasMaxLength(200);

        builder.Property(t => t.ServiceUrl)
            .HasMaxLength(500);

        builder.Property(t => t.TenantId)
            .HasMaxLength(100);

        builder.Property(t => t.AadGroupId)
            .HasMaxLength(100);

        builder.HasIndex(t => t.AadGroupId)
            .HasDatabaseName("IX_Teams_AadGroupId")
            .IsUnique()
            .HasFilter("[AadGroupId] IS NOT NULL");
    }
}
