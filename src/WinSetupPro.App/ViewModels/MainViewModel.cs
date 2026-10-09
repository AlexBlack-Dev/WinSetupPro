using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using WinSetupPro.App.Services;
using WinSetupPro.Core;
using WinSetupPro.Infra;

namespace WinSetupPro.App.ViewModels;

/// <summary>Shared session state: catalog, search, profiles, selection. Singleton.</summary>
public sealed partial class MainViewModel : ObservableObject
{
    private readonly ISoftwareCatalog _catalog;
    private readonly SettingsStore _settings;
    private readonly QueueViewModel _queue;

    public LocalizationService Loc { get; }

    public List<AppItemViewModel> AllApps { get; } = [];

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private int _selectedCount;

    public IReadOnlyList<SoftwareProfile> Profiles { get; }

    public List<ProfileChipViewModel> ProfileChips { get; } = [];

    public MainViewModel(
        ISoftwareCatalog catalog,
        SettingsStore settings,
        LocalizationService loc,
        QueueViewModel queue)
    {
        _catalog = catalog;
        _settings = settings;
        Loc = loc;
        _queue = queue;
        Profiles = catalog.Profiles;

        foreach (var app in catalog.Apps.OrderBy(a => a.DisplayName(loc.Lang)))
            AllApps.Add(new AppItemViewModel(app, settings.Value.SelectedIds.Contains(app.Id), settings, this, loc));
        foreach (var p in catalog.Profiles)
            ProfileChips.Add(new ProfileChipViewModel(p, loc));
        RefreshCount();
    }

    public IEnumerable<AppItemViewModel> Filtered =>
        string.IsNullOrWhiteSpace(SearchQuery)
            ? AllApps
            : AllApps.Where(a =>
                a.Item.DisplayName(Loc.Lang).Contains(SearchQuery, StringComparison.OrdinalIgnoreCase) ||
                a.Item.Id.Contains(SearchQuery, StringComparison.OrdinalIgnoreCase));

    partial void OnSearchQueryChanged(string value)
    {
        OnPropertyChanged(nameof(Filtered));
        OnPropertyChanged(nameof(IsFilteredEmpty));
    }

    public bool IsFilteredEmpty => !Filtered.Any();

    public string CatalogStats => $"{AllApps.Count} {Loc.Get("apps")} · {Profiles.Count} {Loc.Get("profilesWord")}";

    public void RefreshLanguage()
    {
        foreach (var app in AllApps)
            app.Refresh();
        foreach (var chip in ProfileChips)
            chip.Refresh();
        OnPropertyChanged(nameof(Filtered));
        OnPropertyChanged(nameof(Profiles));
        OnPropertyChanged(nameof(ProfileChips));
        OnPropertyChanged(nameof(SelectionSummary));
        OnPropertyChanged(nameof(CatalogStats));
        OnPropertyChanged(nameof(IsFilteredEmpty));
    }

    public void RefreshCount()
    {
        SelectedCount = AllApps.Count(a => a.IsSelected);
        OnPropertyChanged(nameof(SelectionSummary));
    }

    public string SelectionSummary => $"{Loc["selected"]}: {SelectedCount}";

    [RelayCommand]
    private void ApplyProfile(string profileId)
    {
        _settings.Value.ProfileEdits.TryGetValue(profileId, out var edit);
        var items = ProfileService.Resolve(_catalog, profileId, edit?.Added, edit?.Removed);
        var ids = items.Select(i => i.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var app in AllApps)
            app.IsSelected = ids.Contains(app.Item.Id);
    }

    [RelayCommand]
    private void ClearSelection()
    {
        foreach (var app in AllApps)
            app.IsSelected = false;
    }

    [RelayCommand]
    private void BuildQueue()
    {
        _queue.SyncFromSelection(AllApps.Where(a => a.IsSelected).Select(a => a.Item).ToList());
    }
}

/// <summary>Profile chip with live language refresh.</summary>
public sealed partial class ProfileChipViewModel : ObservableObject
{
    private readonly SoftwareProfile _profile;
    private readonly LocalizationService _loc;

    public string Id => _profile.Id;
    public int Count => _profile.AppIds.Length;
    public string DisplayName => _profile.DisplayName(_loc.Lang);
    public string DisplayWithCount => $"{DisplayName} · {Count}";

    public ProfileChipViewModel(SoftwareProfile profile, LocalizationService loc)
    {
        _profile = profile;
        _loc = loc;
    }

    public void Refresh()
    {
        OnPropertyChanged(nameof(DisplayName));
        OnPropertyChanged(nameof(DisplayWithCount));
    }
}
