using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="ExportJob"/> entity.
/// </summary>
internal sealed class ExportJobConfiguration : IEntityTypeConfiguration<ExportJob>
{
    public void Configure(EntityTypeBuilder<ExportJob> builder)
    {
        builder.ToTable("ExportJobs");

        builder.HasKey(ej => ej.Id);

        builder.Property(ej => ej.Id)
            .ValueGeneratedNever();

        builder.Property(ej => ej.RequestedBy)
            .HasMaxLength(200);

        builder.Property(ej => ej.Status)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(ej => ej.FileName)
            .HasMaxLength(500);
    }
}
