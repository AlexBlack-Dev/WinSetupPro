namespace WinSetupPro.Shared;

public enum InstallStatus
{
    Queued,
    Running,
    Succeeded,
    Failed,
    Skipped,
    Cancelled
}

public enum InstallEventKind
{
    Info,
    Progress,
    Success,
    Error
}

/// <summary>Single streaming event from an engine. UI subscribes, never polls.</summary>
public sealed record InstallEvent(string Message, InstallEventKind Kind = InstallEventKind.Info, int? Progress = null);

/// <summary>Queue entry. Mutable status lives ONLY in the ViewModel; engines stay stateless.</summary>
public sealed record InstallJob(string ItemId)
{
    public InstallStatus Status { get; set; } = InstallStatus.Queued;
    public string Log { get; set; } = string.Empty;
}
