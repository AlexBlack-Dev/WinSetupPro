using CommunityToolkit.Mvvm.ComponentModel;
using WinSetupPro.App.Services;
using WinSetupPro.App.ViewModels;

namespace WinSetupPro.App.Views;

public sealed partial class ShellViewModel : ObservableObject
{
    private readonly MainViewModel _main;
    public LocalizationService Loc => _main.Loc;

    public ShellViewModel(MainViewModel main)
    {
        _main = main;
        _main.PropertyChanged += (_, e) =>
        {
            if (e.PropertyName is nameof(MainViewModel.SelectedCount) || string.IsNullOrEmpty(e.PropertyName))
            {
                OnPropertyChanged(nameof(QueueBadge));
                OnPropertyChanged(nameof(QueueBadgeVisible));
            }
        };
    }

    public string QueueBadge => _main.SelectedCount.ToString();
    public bool QueueBadgeVisible => _main.SelectedCount > 0;
}
