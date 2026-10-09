using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using System.Diagnostics;
using WinSetupPro.App.Services;
using WinSetupPro.App.Views;
using WinSetupPro.Core;
using WinSetupPro.Infra;

namespace WinSetupPro.App.ViewModels;

public sealed partial class JobItemViewModel : ObservableObject
{
    public SoftwareItem Item { get; }
    public InstallJob Job { get; } = new(string.Empty);
    private readonly LocalizationService _loc;

    [ObservableProperty]
    private string _statusText = string.Empty;

    [ObservableProperty]
    private string _logTail = string.Empty;

    [ObservableProperty]
    private double _progress;

    [ObservableProperty]
    private bool _isActive;

    public JobItemViewModel(SoftwareItem item, LocalizationService loc)
    {
        Item = item;
        _loc = loc;
        Job = new InstallJob(item.Id);
        Tile = new AppTile(item);
        RefreshStatus();
    }

    public string DisplayName => Item.DisplayName(_loc.Lang);

    public AppTile Tile { get; }

    public void RefreshStatus()
    {
        StatusText = Job.Status switch
        {
            InstallStatus.Running => _loc["statusRunning"],
            InstallStatus.Succeeded => _loc["statusDone"],
            InstallStatus.Failed => _loc["statusFailed"],
            InstallStatus.Skipped => _loc["statusSkipped"],
            InstallStatus.Cancelled => _loc["cancel"],
            _ => _loc["statusQueued"],
        };
        IsActive = Job.Status == InstallStatus.Running;
        OnPropertyChanged(nameof(DisplayName));
    }

    public void AppendLog(string line)
    {
        // Cap stored log: last 40 lines only — unbounded strings stall the UI thread.
        var kept = Job.Log.Split('\n');
        Job.Log = kept.Length > 40
            ? string.Join('\n', kept[^40..]) + line + "\n"
            : Job.Log + line + "\n";
        LogTail = line; // last line preview
    }
}

/// <summary>Sequential install queue. One engine at a time — parallel MSI installs corrupt state.</summary>
public sealed partial class QueueViewModel : ObservableObject
{
    private readonly JobRunner _runner;
    private readonly SettingsStore _settings;
    private CancellationTokenSource? _cts;
    private Action<string>? _onSelectionRemoved;
    private HashSet<string>? _lastBuilt;

    public LocalizationService Loc { get; }

    public List<JobItemViewModel> Jobs { get; private set; } = [];

    [ObservableProperty]
    private bool _isRunning;

    [ObservableProperty]
    private string _liveLog = string.Empty;

    [ObservableProperty]
    private double _overallProgress;

    [ObservableProperty]
    private bool _isEmpty = true;

    [ObservableProperty]
    private bool _needsAdmin;

    public QueueViewModel(JobRunner runner, SettingsStore settings, LocalizationService loc)
    {
        _runner = runner;
        _settings = settings;
        Loc = loc;
        NeedsAdmin = !Privilege.IsAdmin();
    }

    /// <summary>Rebuild only when the selection actually changed — keeps statuses on back-nav.</summary>
    public void SyncFromSelection(IReadOnlyList<SoftwareItem> items, Action<string>? onSelectionRemoved = null)
    {
        _onSelectionRemoved = onSelectionRemoved;
        var set = items.Select(i => i.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (_lastBuilt is not null && _lastBuilt.SetEquals(set) && Jobs.Count > 0)
            return;
        _lastBuilt = set;
        Jobs = items.Select(i => new JobItemViewModel(i, Loc)).ToList();
        LiveLog = string.Empty;
        OverallProgress = 0;
        IsEmpty = items.Count == 0;
        OnPropertyChanged(nameof(Jobs));
        OnPropertyChanged(nameof(JobCount));
        RefreshCommands();
    }

    public int JobCount => Jobs.Count;

    public void RefreshLanguage()
    {
        foreach (var j in Jobs)
            j.RefreshStatus();
    }

    private bool CanRunAll() => !IsRunning && Jobs.Count > 0;
    private bool CanCancel() => IsRunning;

    private void RefreshCommands()
    {
        RunAllCommand.NotifyCanExecuteChanged();
        CancelCommand.NotifyCanExecuteChanged();
        ClearFinishedCommand.NotifyCanExecuteChanged();
    }

    [RelayCommand(CanExecute = nameof(CanRunAll))]
    private async Task RunAllAsync()
    {
        if (!CanRunAll()) return;
        IsRunning = true;
        RefreshCommands();
        _cts = new CancellationTokenSource();
        var queue = Microsoft.UI.Xaml.Application.Current is null ? null : App.Window.DispatcherQueue;

        // Best-effort restore point, never blocks.
        AppendLog(Loc["createRestore"] + "…");
        var rp = await RestorePointService.TryCreateAsync("WinSetupPro bulk install").ConfigureAwait(false);
        AppendLog(rp ? Loc["restoreCreated"] : Loc["restoreFailed"]);

        int done = 0;
        foreach (var job in Jobs)
        {
            if (_cts.Token.IsCancellationRequested) break;
            SetStatus(job, InstallStatus.Running);
            AppendLog($"── {job.Item.DisplayName(Loc.Lang)} ──");

            await _runner.RunAsync(job.Job, ev =>
            {
                queue?.TryEnqueue(() =>
                {
                    job.AppendLog(ev.Message);
                    AppendLog(ev.Message);
                    if (ev.Progress.HasValue) job.Progress = ev.Progress.Value;
                });
            }, _cts.Token).ConfigureAwait(false);

            queue?.TryEnqueue(() =>
            {
                SetStatus(job, job.Job.Status);
                job.Progress = job.Job.Status is InstallStatus.Succeeded or InstallStatus.Skipped ? 100 : job.Progress;
                done++;
                OverallProgress = done * 100.0 / Jobs.Count;
            });
        }

        queue?.TryEnqueue(() =>
        {
            IsRunning = false;
            RefreshCommands();
        });
    }

    [RelayCommand(CanExecute = nameof(CanCancel))]
    private void Cancel() => _cts?.Cancel();

    public void RemoveJob(string itemId)
    {
        if (IsRunning) return;
        if (Jobs.All(j => j.Item.Id != itemId)) return;
        Jobs = Jobs.Where(j => j.Item.Id != itemId).ToList();
        _onSelectionRemoved?.Invoke(itemId);
        _lastBuilt?.Remove(itemId);
        IsEmpty = Jobs.Count == 0;
        OnPropertyChanged(nameof(Jobs));
        OnPropertyChanged(nameof(JobCount));
        RefreshCommands();
    }

    private bool CanClearFinished() => !IsRunning && Jobs.Count > 0;

    [RelayCommand(CanExecute = nameof(CanClearFinished))]
    private void ClearFinished()
    {
        if (IsRunning) return;
        Jobs = Jobs.Where(j => j.Job.Status is not (InstallStatus.Succeeded or InstallStatus.Skipped)).ToList();
        IsEmpty = Jobs.Count == 0;
        OnPropertyChanged(nameof(Jobs));
        OnPropertyChanged(nameof(JobCount));
        RefreshCommands();
    }

    [RelayCommand]
    private void RestartAsAdmin()
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = Privilege.ExePath(),
                UseShellExecute = true,
                Verb = "runas",
                WorkingDirectory = AppContext.BaseDirectory,
            };
            Process.Start(psi);
            Application.Current.Exit();
        }
        catch { /* UAC declined — stay where we are */ }
    }

    private void SetStatus(JobItemViewModel job, InstallStatus status)
    {
        job.Job.Status = status;
        job.RefreshStatus();
    }

    private void AppendLog(string line)
    {
        // Always via queue + capped at 400 lines: keeps install output smooth.
        App.Window.DispatcherQueue.TryEnqueue(() =>
        {
            var lines = LiveLog.Split('\n');
            LiveLog = lines.Length > 400
                ? string.Join('\n', lines[^400..]) + line + "\n"
                : LiveLog + line + "\n";
        });
    }
}
