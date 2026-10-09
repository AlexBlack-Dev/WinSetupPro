using System.Runtime.CompilerServices;

namespace WinSetupPro.Infra;

/// <summary>Scoop engine — complement for portable CLI tools, no UAC, user scope.</summary>
public sealed class ScoopEngine : IInstallEngine
{
    public EngineKind Kind => EngineKind.Scoop;
    private const string ExeName = "scoop";

    private static string? _resolved;
    private static readonly object _gate = new();
    private static string Exe
    {
        get
        {
            lock (_gate)
            {
                if (_resolved is not null) return _resolved;
                var shim = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    @"scoop\shims\scoop.exe");
                return _resolved = File.Exists(shim) ? shim : ExeName;
            }
        }
    }

    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            var r = await ProcessRunner.RunAsync(Exe, ["--version"], ct).ConfigureAwait(false);
            return r.ExitCode == 0;
        }
        catch { return false; }
    }

    public bool CanHandle(SoftwareItem item) => !string.IsNullOrWhiteSpace(item.ScoopName);

    public async Task<bool> IsInstalledAsync(SoftwareItem item, CancellationToken ct = default)
    {
        if (item.ScoopName is null) return false;
        try
        {
            var r = await ProcessRunner.RunAsync(Exe, ["list", item.ScoopName], ct).ConfigureAwait(false);
            return r.ExitCode == 0 && r.StdOut.Contains(item.ScoopName, StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    public async IAsyncEnumerable<InstallEvent> InstallAsync(
        SoftwareItem item, [EnumeratorCancellation] CancellationToken ct = default)
    {
        if (item.ScoopName is null)
        {
            yield return new InstallEvent("No scoop manifest for this app.", InstallEventKind.Error);
            yield break;
        }

        yield return new InstallEvent($"scoop install {item.ScoopName}", InstallEventKind.Info);

        int exit = -1;
        await foreach (var line in ProcessRunner.StreamAsync(Exe, ["install", item.ScoopName], ct).ConfigureAwait(false))
        {
            if (line.StartsWith("EXIT:", StringComparison.Ordinal))
                exit = int.TryParse(line[5..], out var c) ? c : -1;
            else if (line.StartsWith("ERR:", StringComparison.Ordinal))
                yield return new InstallEvent(line, InstallEventKind.Error);
            else
                yield return new InstallEvent(line, InstallEventKind.Info);
        }

        yield return exit == 0
            ? new InstallEvent("Installed cleanly.", InstallEventKind.Success, 100)
            : new InstallEvent($"scoop exit code {exit}.", InstallEventKind.Error);
    }
}
