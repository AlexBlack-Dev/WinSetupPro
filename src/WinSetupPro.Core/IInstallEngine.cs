namespace WinSetupPro.Core;

/// <summary>
/// Stateless install engine. Streams log events; never touches UI.
/// Implementations: WingetEngine, ScoopEngine (Infra).
/// </summary>
public interface IInstallEngine
{
    EngineKind Kind { get; }

    /// <summary>e.g. winget.exe / scoop.cmd present and callable.</summary>
    Task<bool> IsAvailableAsync(CancellationToken ct = default);

    bool CanHandle(SoftwareItem item);

    /// <summary>True when the app (exact id) is already installed — enables skip.</summary>
    Task<bool> IsInstalledAsync(SoftwareItem item, CancellationToken ct = default);

    IAsyncEnumerable<InstallEvent> InstallAsync(SoftwareItem item, CancellationToken ct = default);
}
