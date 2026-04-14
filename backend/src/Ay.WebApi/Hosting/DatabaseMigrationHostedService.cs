using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ay.WebApi.Hosting;

/// <summary>
/// Runs pending EF Core migrations on startup using a scoped <see cref="AppDbContext"/>.
/// </summary>
public sealed class DatabaseMigrationHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<DatabaseMigrationHostedService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        logger.LogInformation("Applying database migrations…");
        await db.Database.MigrateAsync(cancellationToken);
        logger.LogInformation("Database migrations are up to date.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
