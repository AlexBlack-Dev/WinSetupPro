using CommunityToolkit.Mvvm.ComponentModel;
using WinSetupPro.App.Services;
using WinSetupPro.App.Views;
using WinSetupPro.Infra;

namespace WinSetupPro.App.ViewModels;

/// <summary>One card in the catalog. Selection persists to settings.json immediately.</summary>
public sealed partial class AppItemViewModel : ObservableObject
{
    private readonly SettingsStore _settings;
    private readonly MainViewModel _parent;
    private readonly LocalizationService _loc;

    public SoftwareItem Item { get; }

    [ObservableProperty]
    private bool _isSelected;

    public string DisplayName => Item.DisplayName(_loc.Lang);
    public string DisplayDescription => Item.DisplayDescription(_loc.Lang);
    public string EngineLabel => Item.PreferredEngine == EngineKind.Scoop ? "scoop" : "winget";
    public string CategoryLabel => CategoryTile.CategoryName(Item.Category, _loc.Lang);

    /// <summary>Real brand icon when shipped in catalog/icons; monogram tile otherwise.</summary>
    public AppTile Tile { get; }

    public AppItemViewModel(SoftwareItem item, bool selected, SettingsStore settings, MainViewModel parent, LocalizationService loc)
    {
        Item = item;
        _isSelected = selected;
        _settings = settings;
        _parent = parent;
        _loc = loc;
        Tile = new AppTile(item);
    }

    public void Refresh() => OnPropertyChanged(string.Empty);

    partial void OnIsSelectedChanged(bool value)
    {
        if (value)
            _settings.Value.SelectedIds.Add(Item.Id);
        else
            _settings.Value.SelectedIds.Remove(Item.Id);
        _settings.Save();
        _parent.RefreshCount();
    }

    public string Name(string lang) => Item.DisplayName(lang);
    public string Description(string lang) => Item.DisplayDescription(lang);
}
