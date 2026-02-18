using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CompanyCommunicator.Core.Data;

/// <summary>
/// Design-time factory used by <c>dotnet ef</c> to create an <see cref="AppDbContext"/>
/// without starting the application host. The connection string is read from the
/// <c>ConnectionStrings__SqlConnection</c> environment variable (set by CI/CD).
/// </summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SqlConnection")
            ?? "Server=.;Database=CompanyCommunicator;Trusted_Connection=True;TrustServerCertificate=True;";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }
}
