namespace WinSetupPro.Core;

/// <summary>
/// Sequential queue runner. One install at a time (parallel installs corrupt MSI/winget state).
/// Skips already-installed apps, streams events via callback.
/// </summary>
public sealed class JobRunner(ISoftwareCatalog catalog, IEnumerable<IInstallEngine> engines)
{
    private readonly Dictionary<EngineKind, IInstallEngine> _engines = engines.ToDictionary(e => e.Kind);

    public async Task<InstallStatus> RunAsync(
        InstallJob job,
        Action<InstallEvent>? onEvent = null,
        CancellationToken ct = default)
    {
        var item = catalog.Find(job.ItemId);
        if (item is null)
        {
            job.Status = InstallStatus.Failed;
            onEvent?.Invoke(new InstallEvent($"Unknown app id: {job.ItemId}", InstallEventKind.Error));
            return job.Status;
        }

        var engine = SelectEngine(item);
        if (engine is null)
        {
            job.Status = InstallStatus.Failed;
            onEvent?.Invoke(new InstallEvent($"No engine for {item.DisplayName("en")}", InstallEventKind.Error));
            return job.Status;
        }

        if (!await engine.IsAvailableAsync(ct).ConfigureAwait(false))
        {
            job.Status = InstallStatus.Failed;
            onEvent?.Invoke(new InstallEvent($"{engine.Kind} is not available on this PC.", InstallEventKind.Error));
            return job.Status;
        }

        try
        {
            if (await engine.IsInstalledAsync(item, ct).ConfigureAwait(false))
            {
                job.Status = InstallStatus.Skipped;
                onEvent?.Invoke(new InstallEvent("Already installed — skipped.", InstallEventKind.Success));
                return job.Status;
            }
        }
        catch (OperationCanceledException) { job.Status = InstallStatus.Cancelled; throw; }

        job.Status = InstallStatus.Running;
        try
        {
            await foreach (var ev in engine.InstallAsync(item, ct).ConfigureAwait(false))
                onEvent?.Invoke(ev);

            job.Status = InstallStatus.Succeeded;
            onEvent?.Invoke(new InstallEvent("Done.", InstallEventKind.Success, 100));
        }
        catch (OperationCanceledException)
        {
            job.Status = InstallStatus.Cancelled;
            onEvent?.Invoke(new InstallEvent("Cancelled by user.", InstallEventKind.Error));
        }
        catch (Exception ex)
        {
            job.Status = InstallStatus.Failed;
            onEvent?.Invoke(new InstallEvent($"Failed: {ex.Message}", InstallEventKind.Error));
        }
        return job.Status;
    }

    private IInstallEngine? SelectEngine(SoftwareItem item)
    {
        if (_engines.TryGetValue(item.PreferredEngine, out var preferred) && preferred.CanHandle(item))
            return preferred;
        return _engines.Values.FirstOrDefault(e => e.CanHandle(item));
    }
}
