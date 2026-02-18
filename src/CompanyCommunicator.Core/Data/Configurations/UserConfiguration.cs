using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

/// <summary>
/// EF Core fluent configuration for the <see cref="User"/> entity.
/// </summary>
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.AadId);

        builder.Property(u => u.AadId)
            .IsRequired()
            .HasMaxLength(100)
            .ValueGeneratedNever();

        builder.Property(u => u.Name)
            .HasMaxLength(200);

        builder.Property(u => u.Email)
            .HasMaxLength(200);

        builder.Property(u => u.Upn)
            .HasMaxLength(200);

        builder.Property(u => u.UserId)
            .HasMaxLength(200);

        builder.Property(u => u.ConversationId)
            .HasMaxLength(500);

        builder.Property(u => u.ServiceUrl)
            .HasMaxLength(500);

        builder.Property(u => u.TenantId)
            .HasMaxLength(100);

        builder.Property(u => u.UserType)
            .HasMaxLength(20);
    }
}
