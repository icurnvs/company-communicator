using System.Reflection;
using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CompanyCommunicator.Core.Data;

/// <summary>
/// EF Core database context for Company Communicator.
/// Targets Azure SQL (SQL Server compatibility mode) with automatic retry-on-failure
/// for transient faults.
/// </summary>
public sealed class AppDbContext : DbContext
{
    /// <summary>
    /// Initialises a new instance of <see cref="AppDbContext"/> using the supplied options.
    /// </summary>
    /// <param name="options">DbContext options injected by the DI container.</param>
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    // -----------------------------------------------------------------
    // DbSets
    // -----------------------------------------------------------------

    /// <summary>Gets or sets the notifications table.</summary>
    public DbSet<Notification> Notifications => Set<Notification>();

    /// <summary>Gets or sets the notification audience targets table.</summary>
    public DbSet<NotificationAudience> NotificationAudiences => Set<NotificationAudience>();

    /// <summary>Gets or sets the per-recipient send records table.</summary>
    public DbSet<SentNotification> SentNotifications => Set<SentNotification>();

    /// <summary>Gets or sets the tracked Teams users table.</summary>
    public DbSet<User> Users => Set<User>();

    /// <summary>Gets or sets the tracked Teams teams table.</summary>
    public DbSet<Team> Teams => Set<Team>();

    /// <summary>Gets or sets the send-pipeline throttle state table.</summary>
    public DbSet<ThrottleState> ThrottleState => Set<ThrottleState>();

    /// <summary>Gets or sets the export jobs table.</summary>
    public DbSet<ExportJob> ExportJobs => Set<ExportJob>();

    /// <summary>Gets or sets the runtime application configuration table.</summary>
    public DbSet<AppConfiguration> AppConfiguration => Set<AppConfiguration>();

    /// <summary>Gets or sets the card templates table.</summary>
    public DbSet<Template> Templates => Set<Template>();

    // -----------------------------------------------------------------
    // Model configuration
    // -----------------------------------------------------------------

    /// <inheritdoc/>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Discover and apply all IEntityTypeConfiguration<T> classes in this assembly.
        // Each entity has its own configuration class under Data/Configurations/.
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}

/// <summary>
/// Extension methods for registering <see cref="AppDbContext"/> in the DI container
/// with production-suitable SQL Server options.
/// </summary>
public static class AppDbContextServiceCollectionExtensions
{
    /// <summary>
    /// Adds <see cref="AppDbContext"/> to the service collection configured for Azure SQL
    /// with automatic retry-on-failure for transient faults.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="connectionString">The SQL Server connection string.</param>
    /// <returns>The modified service collection for chaining.</returns>
    public static IServiceCollection AddAppDbContext(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(
                connectionString,
                sqlServerOptions => sqlServerOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(30),
                    errorNumbersToAdd: null)));

        return services;
    }
}
