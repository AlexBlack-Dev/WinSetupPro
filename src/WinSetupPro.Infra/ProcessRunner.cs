using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text;

namespace WinSetupPro.Infra;

/// <summary>Safe process runner: ArgumentList (no shell injection), async streaming, cooperative cancel.</summary>
public static class ProcessRunner
{
    public sealed record Result(int ExitCode, string StdOut, string StdErr);

    public static async IAsyncEnumerable<string> StreamAsync(
        string exe,
        IEnumerable<string> args,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = exe,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in args)
            process.StartInfo.ArgumentList.Add(a);

        var output = new StringBuilder();
        process.OutputDataReceived += (_, e) => { if (e.Data is not null) output.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) output.AppendLine(e.Data); };

        string? startError = null;
        try
        {
            if (!process.Start())
                startError = $"ERR: cannot start {exe}";
        }
        catch (Exception ex)
        {
            startError = $"ERR: {exe} not available ({ex.Message})";
        }

        if (startError is not null)
        {
            yield return startError;
            yield break;
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        var cancelled = false;
        try
        {
            await process.WaitForExitAsync(ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            cancelled = true;
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { /* best effort */ }
        }

        foreach (var line in output.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            yield return line;

        if (cancelled)
            yield return "ERR: cancelled, process killed.";

        int exit;
        try { exit = process.HasExited ? process.ExitCode : -1; }
        catch { exit = -1; }
        yield return $"EXIT:{exit}";
    }

    public static async Task<Result> RunAsync(string exe, IEnumerable<string> args, CancellationToken ct = default)
    {
        var sb = new StringBuilder();
        var err = new StringBuilder();
        int exit = -1;
        await foreach (var line in StreamAsync(exe, args, ct).ConfigureAwait(false))
        {
            if (line.StartsWith("EXIT:", StringComparison.Ordinal) && int.TryParse(line[5..], out var code))
                exit = code;
            else if (line.StartsWith("ERR:", StringComparison.Ordinal))
                err.AppendLine(line);
            else
                sb.AppendLine(line);
        }
        return new Result(exit, sb.ToString(), err.ToString());
    }
}
