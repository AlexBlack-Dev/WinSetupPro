namespace WinSetupPro.Infra;

/// <summary>
/// Best-effort restore point before bulk install. Requires admin; on failure returns false
/// and install proceeds — never blocks the user.
/// </summary>
public static class RestorePointService
{
    public static async Task<bool> TryCreateAsync(string description, CancellationToken ct = default)
    {
        try
        {
            var ps = "Checkpoint-Computer -Description '" +
                     description.Replace("'", "", StringComparison.Ordinal) +
                     "' -RestorePointType 'MODIFY_SETTINGS'";
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromMinutes(2));
            var result = await ProcessRunner.RunAsync(
                "powershell",
                ["-NoProfile", "-NonInteractive", "-Command", ps],
                cts.Token).ConfigureAwait(false);
            return result.ExitCode == 0;
        }
        catch { return false; }
    }
}
