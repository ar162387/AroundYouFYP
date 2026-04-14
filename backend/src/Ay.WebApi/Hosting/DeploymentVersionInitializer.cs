namespace Ay.WebApi.Hosting;

/// <summary>
/// Runs once at startup so /health/version reflects deploy transitions before traffic is served.
/// </summary>
public sealed class DeploymentVersionInitializer(
    DeploymentVersionState state,
    IWebHostEnvironment env,
    ILogger<DeploymentVersionState> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        state.Initialize(env, logger);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
