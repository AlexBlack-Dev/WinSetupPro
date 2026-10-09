using System.Runtime.CompilerServices;

namespace WinSetupPro.Infra;

/// <summary>
/// Winget engine — primary. Clean-install flags only, official vendor binaries, hash-verified.
/// Never passes user text into shell: exact --id from curated catalog.
/// </summary>
public sealed class WingetEngine : IInstallEngine
{
    public EngineKind Kind => EngineKind.Winget;
    private const string ExeName = "winget";

    // Unpackaged processes sometimes miss the AppX alias on PATH — prefer the full path.
    private static string? _resolved;
    private static readonly object _gate = new();
    private static string Exe
    {
        get
        {
            lock (_gate)
            {
                if (_resolved is not null) return _resolved;
                var local = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    @"Microsoft\WindowsApps\winget.exe");
                return _resolved = File.Exists(local) ? local : ExeName;
            }
        }
    }

    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            var r = await ProcessRunner.RunAsync(Exe, ["--version"], ct).ConfigureAwait(false);
            return r.ExitCode == 0 && !string.IsNullOrWhiteSpace(r.StdOut);
        }
        catch { return false; }
    }

    public bool CanHandle(SoftwareItem item) => !string.IsNullOrWhiteSpace(item.WingetId);

    public async Task<bool> IsInstalledAsync(SoftwareItem item, CancellationToken ct = default)
    {
        if (item.WingetId is null) return false;
        try
        {
            var r = await ProcessRunner.RunAsync(Exe,
                ["list", "--exact", "--id", item.WingetId, "--accept-source-agreements"], ct).ConfigureAwait(false);
            return r.ExitCode == 0 && r.StdOut.Contains(item.WingetId, StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    public async IAsyncEnumerable<InstallEvent> InstallAsync(
        SoftwareItem item, [EnumeratorCancellation] CancellationToken ct = default)
    {
        if (item.WingetId is null)
        {
            yield return new InstallEvent("No winget id for this app.", InstallEventKind.Error);
            yield break;
        }

        // Clean & unattended: silent, no prompts, no bundled offers.
        string[] args =
        [
            "install", "--exact", "--id", item.WingetId,
            "--silent", "--disable-interactivity",
            "--accept-package-agreements", "--accept-source-agreements"
        ];

        yield return new InstallEvent($"winget install {item.WingetId}", InstallEventKind.Info);

        int exit = -1;
        await foreach (var line in ProcessRunner.StreamAsync(Exe, args, ct).ConfigureAwait(false))
        {
            if (line.StartsWith("EXIT:", StringComparison.Ordinal))
            {
                exit = int.TryParse(line[5..], out var c) ? c : -1;
            }
            else if (line.StartsWith("ERR:", StringComparison.Ordinal))
            {
                yield return new InstallEvent(line, InstallEventKind.Error);
            }
            else
            {
                yield return new InstallEvent(line, InstallEventKind.Info);
            }
        }

        if (exit == 0)
            yield return new InstallEvent("Installed cleanly.", InstallEventKind.Success, 100);
        else if (exit == -1978335212) // 0x8A150109: already installed / newer version present
            yield return new InstallEvent("Already present (winget).", InstallEventKind.Success, 100);
        else
            yield return new InstallEvent($"winget exit code {exit}. See log above.", InstallEventKind.Error);
    }
}
