using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using WinSetupPro.App.ViewModels;

namespace WinSetupPro.App.Views;

public sealed partial class QueuePage : Page
{
    public QueueViewModel ViewModel { get; }

    public QueuePage()
    {
        ViewModel = App.Services.GetRequiredService<QueueViewModel>();
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        // Queue always mirrors the live catalog selection; unchecking stays in sync both ways.
        var main = App.Services.GetRequiredService<MainViewModel>();
        ViewModel.SyncFromSelection(
            main.AllApps.Where(a => a.IsSelected).Select(a => a.Item).ToList(),
            id =>
            {
                var app = main.AllApps.FirstOrDefault(a => a.Item.Id == id);
                if (app is not null) app.IsSelected = false;
            });
    }

    private void Back_Click(object sender, RoutedEventArgs e) => Frame.Navigate(typeof(CatalogPage));

    private void RemoveJob_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string id })
            ViewModel.RemoveJob(id);
    }
}
