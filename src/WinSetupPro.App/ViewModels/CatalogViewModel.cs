using CommunityToolkit.Mvvm.ComponentModel;
using WinSetupPro.App.Services;

namespace WinSetupPro.App.ViewModels;

/// <summary>Thin filter VM so CatalogPage stays dumb. Real state lives in MainViewModel.</summary>
public sealed partial class CatalogViewModel : ObservableObject
{
    public MainViewModel Main { get; }
    public LocalizationService Loc => Main.Loc;

    public CatalogViewModel(MainViewModel main) => Main = main;
}
