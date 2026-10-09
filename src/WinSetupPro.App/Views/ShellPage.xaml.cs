using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml.Controls;
using WinSetupPro.App.ViewModels;

namespace WinSetupPro.App.Views;

/// <summary>Navigation shell. Badge shows queued count with a gradient pill.</summary>
public sealed partial class ShellPage : Page
{
    public ShellViewModel ViewModel { get; }

    public ShellPage()
    {
        ViewModel = new ShellViewModel(App.Services.GetRequiredService<MainViewModel>());
        InitializeComponent();
        Nav.SelectedItem = CatalogItem;
        ContentFrame.Navigate(typeof(CatalogPage));
    }

    private void Nav_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItem is NavigationViewItem item)
        {
            var page = item.Tag?.ToString() switch
            {
                "queue" => typeof(QueuePage),
                "settings" => typeof(SettingsPage),
                _ => typeof(CatalogPage),
            };
            ContentFrame.Navigate(page);
        }
    }
}
