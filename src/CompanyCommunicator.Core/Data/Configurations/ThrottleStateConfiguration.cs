using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="ThrottleState"/> entity.
/// Enables SQL Server rowversion-based optimistic concurrency.
/// </summary>
internal sealed class ThrottleStateConfiguration : IEntityTypeConfiguration<ThrottleState>
{
    public void Configure(EntityTypeBuilder<ThrottleState> builder)
    {
        builder.ToTable("ThrottleState");

        builder.HasKey(ts => ts.Id);

        builder.Property(ts => ts.Id)
            .IsRequired()
            .HasMaxLength(100)
            .ValueGeneratedNever();

        // IsRowVersion() maps to SQL Server's rowversion / timestamp type and
        // automatically participates in EF Core optimistic concurrency checks.
        builder.Property(ts => ts.RowVersion)
            .IsRowVersion()
            .IsConcurrencyToken();
    }
}
