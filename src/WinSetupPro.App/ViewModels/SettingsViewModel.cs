using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using WinSetupPro.App.Services;
using WinSetupPro.Core;
using WinSetupPro.Infra;

namespace WinSetupPro.App.ViewModels;

public sealed partial class SettingsViewModel : ObservableObject
{
    private readonly SettingsStore _settings;
    private readonly ThemeService _theme;
    private readonly IEnumerable<IInstallEngine> _engines;
    private readonly QueueViewModel _queue;

    public LocalizationService Loc { get; }
    public MainViewModel Main { get; }

    [ObservableProperty]
    private bool _wingetAvailable;

    [ObservableProperty]
    private bool _scoopAvailable;

    [ObservableProperty]
    private string _statusLine = string.Empty;

    public string WingetText => WingetAvailable ? Loc["wingetOk"] : Loc["wingetMissing"];
    public string ScoopText => ScoopAvailable ? Loc["scoopOk"] : Loc["scoopMissing"];

    partial void OnWingetAvailableChanged(bool value)
    {
        OnPropertyChanged(nameof(WingetText));
        OnPropertyChanged(nameof(ScoopText));
    }

    partial void OnScoopAvailableChanged(bool value)
    {
        OnPropertyChanged(nameof(WingetText));
        OnPropertyChanged(nameof(ScoopText));
    }

    public void RefreshLanguage()
    {
        OnPropertyChanged(nameof(WingetText));
        OnPropertyChanged(nameof(ScoopText));
    }

    public string[] Languages { get; } = ["ru", "en"];
    public string[] Themes { get; } = ["system", "dark", "light"];

    public string SelectedLang
    {
        get => _settings.Value.Lang;
        set
        {
            _settings.Value.Lang = value;
            _settings.Save();
            Loc.SetLanguage(value);
            Main.RefreshLanguage();
            _queue.RefreshLanguage();
            RefreshLanguage();
            OnPropertyChanged();
        }
    }

    public string SelectedTheme
    {
        get => _settings.Value.Theme;
        set
        {
            _settings.Value.Theme = value;
            _settings.Save();
            _theme.Apply(value);
            OnPropertyChanged();
        }
    }

    public SettingsViewModel(
        SettingsStore settings, LocalizationService loc, ThemeService theme,
        IEnumerable<IInstallEngine> engines, MainViewModel main, QueueViewModel queue)
    {
        _settings = settings;
        Loc = loc;
        _theme = theme;
        _engines = engines;
        Main = main;
        _queue = queue;
    }

    public async Task RefreshEnginesAsync()
    {
        foreach (var e in _engines)
        {
            var ok = await e.IsAvailableAsync().ConfigureAwait(false);
            App.Window.DispatcherQueue.TryEnqueue(() =>
            {
                if (e.Kind == EngineKind.Winget) WingetAvailable = ok;
                else ScoopAvailable = ok;
            });
        }
    }

    /// <summary>One-click official Scoop installer (get.scoop.sh), then re-detect.</summary>
    [RelayCommand]
    private async Task InstallScoopAsync()
    {
        StatusLine = "scoop…";
        var result = await ProcessRunner.RunAsync("powershell",
            ["-NoProfile", "-NonInteractive", "-Command",
             "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; Invoke-RestMethod get.scoop.sh | Invoke-Expression"]);
        StatusLine = result.ExitCode == 0 ? Loc["scoopOk"] : result.StdErr.Trim();
        await RefreshEnginesAsync();
    }
}
