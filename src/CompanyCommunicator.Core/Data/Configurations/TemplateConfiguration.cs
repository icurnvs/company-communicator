using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="Template"/> entity.
/// </summary>
internal sealed class TemplateConfiguration : IEntityTypeConfiguration<Template>
{
    public void Configure(EntityTypeBuilder<Template> builder)
    {
        builder.ToTable("Templates");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasDefaultValueSql("NEWSEQUENTIALID()");

        builder.Property(t => t.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(t => t.Description)
            .HasMaxLength(500);

        builder.Property(t => t.CardSchema)
            .IsRequired();

        builder.Property(t => t.CreatedBy)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(t => t.CreatedDate)
            .HasDefaultValueSql("GETUTCDATE()");

        // Index on CreatedBy for efficient per-user template listing.
        builder.HasIndex(t => t.CreatedBy)
            .HasDatabaseName("IX_Templates_CreatedBy");
    }
}
