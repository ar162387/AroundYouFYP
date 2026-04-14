using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ay.WebApi.Hosting;

/// <summary>
/// Persists last deployed version to disk so /health/version can report previous vs current after upgrades.
/// </summary>
public sealed class DeploymentVersionState
{
    private const string MetaFileName = "deployment-meta.json";

    public DeploymentVersionSnapshot Snapshot { get; private set; } =
        DeploymentVersionSnapshot.Uninitialized();

    public void Initialize(IWebHostEnvironment env, ILogger<DeploymentVersionState> logger)
    {
        var asm = Assembly.GetExecutingAssembly();
        var informational =
            asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";
        var assemblyVersion = asm.GetName().Version?.ToString() ?? "unknown";
        var buildUtc = ReadAssemblyMetadata(asm, "BuildUtc") ?? "unknown";

        var metaPath = Path.Combine(env.ContentRootPath, MetaFileName);
        PersistedMeta? previousFile = null;
        try
        {
            if (File.Exists(metaPath))
            {
                var json = File.ReadAllText(metaPath);
                previousFile = JsonSerializer.Deserialize<PersistedMeta>(json);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not read {MetaPath}; treating as first deploy", metaPath);
        }

        var now = DateTimeOffset.UtcNow;
        var nowReadable = FormatHumanUtc(now);

        var isFirstRecordedDeploy = previousFile is null;
        var isUpgrade = !isFirstRecordedDeploy
            && !string.Equals(previousFile!.InformationalVersion, informational, StringComparison.Ordinal);

        if (isFirstRecordedDeploy)
        {
            Snapshot = new DeploymentVersionSnapshot(
                DeployKind: "first",
                PreviousVersion: null,
                PreviousInformationalVersion: null,
                PreviousDeployedAt: null,
                PreviousDeployedAtReadable: null,
                CurrentVersion: assemblyVersion,
                CurrentInformationalVersion: informational,
                CurrentDeployedAt: now,
                CurrentDeployedAtReadable: nowReadable,
                BuildCompiledAtReadable: buildUtc,
                LastProcessStartedAt: now,
                LastProcessStartedAtReadable: nowReadable);
        }
        else if (isUpgrade)
        {
            var prevAt = previousFile!.DeployedAtUtc;
            Snapshot = new DeploymentVersionSnapshot(
                DeployKind: "upgrade",
                PreviousVersion: previousFile.AssemblyVersion,
                PreviousInformationalVersion: previousFile.InformationalVersion,
                PreviousDeployedAt: prevAt,
                PreviousDeployedAtReadable: FormatHumanUtc(prevAt),
                CurrentVersion: assemblyVersion,
                CurrentInformationalVersion: informational,
                CurrentDeployedAt: now,
                CurrentDeployedAtReadable: nowReadable,
                BuildCompiledAtReadable: buildUtc,
                LastProcessStartedAt: now,
                LastProcessStartedAtReadable: nowReadable);
        }
        else
        {
            var recordedAt = previousFile!.DeployedAtUtc;
            Snapshot = new DeploymentVersionSnapshot(
                DeployKind: "restart",
                PreviousVersion: null,
                PreviousInformationalVersion: null,
                PreviousDeployedAt: null,
                PreviousDeployedAtReadable: null,
                CurrentVersion: assemblyVersion,
                CurrentInformationalVersion: informational,
                CurrentDeployedAt: recordedAt,
                CurrentDeployedAtReadable: FormatHumanUtc(recordedAt),
                BuildCompiledAtReadable: buildUtc,
                LastProcessStartedAt: now,
                LastProcessStartedAtReadable: nowReadable);
        }

        try
        {
            var next = new PersistedMeta(
                AssemblyVersion: assemblyVersion,
                InformationalVersion: informational,
                DeployedAtUtc: isUpgrade || isFirstRecordedDeploy ? now : previousFile!.DeployedAtUtc);
            var opts = new JsonSerializerOptions { WriteIndented = true };
            File.WriteAllText(metaPath, JsonSerializer.Serialize(next, opts));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not write {MetaPath}; version endpoint still works but next deploy may lose previous metadata", metaPath);
        }
    }

    private static string? ReadAssemblyMetadata(Assembly asm, string key)
    {
        foreach (var a in asm.GetCustomAttributes<AssemblyMetadataAttribute>())
        {
            if (string.Equals(a.Key, key, StringComparison.OrdinalIgnoreCase))
                return a.Value;
        }

        return null;
    }

    private static string FormatHumanUtc(DateTimeOffset utc) =>
        utc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'", System.Globalization.CultureInfo.InvariantCulture);

    private sealed record PersistedMeta(
        [property: JsonPropertyName("assemblyVersion")] string AssemblyVersion,
        [property: JsonPropertyName("informationalVersion")] string InformationalVersion,
        [property: JsonPropertyName("deployedAtUtc")] DateTimeOffset DeployedAtUtc);
}

public sealed record DeploymentVersionSnapshot(
    string DeployKind,
    string? PreviousVersion,
    string? PreviousInformationalVersion,
    DateTimeOffset? PreviousDeployedAt,
    string? PreviousDeployedAtReadable,
    string CurrentVersion,
    string CurrentInformationalVersion,
    DateTimeOffset CurrentDeployedAt,
    string CurrentDeployedAtReadable,
    string BuildCompiledAtReadable,
    DateTimeOffset LastProcessStartedAt,
    string LastProcessStartedAtReadable)
{
    public static DeploymentVersionSnapshot Uninitialized() =>
        new(
            DeployKind: "initializing",
            PreviousVersion: null,
            PreviousInformationalVersion: null,
            PreviousDeployedAt: null,
            PreviousDeployedAtReadable: null,
            CurrentVersion: "unknown",
            CurrentInformationalVersion: "unknown",
            CurrentDeployedAt: default,
            CurrentDeployedAtReadable: "unknown",
            BuildCompiledAtReadable: "unknown",
            LastProcessStartedAt: default,
            LastProcessStartedAtReadable: "unknown");
}
