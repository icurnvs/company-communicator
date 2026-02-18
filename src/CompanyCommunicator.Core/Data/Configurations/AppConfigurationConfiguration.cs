using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="AppConfiguration"/> entity.
/// </summary>
internal sealed class AppConfigurationConfiguration : IEntityTypeConfiguration<AppConfiguration>
{
    public void Configure(EntityTypeBuilder<AppConfiguration> builder)
    {
        builder.ToTable("AppConfiguration");

        builder.HasKey(ac => ac.Key);

        builder.Property(ac => ac.Key)
            .IsRequired()
            .HasMaxLength(200)
            .ValueGeneratedNever();
    }
}
