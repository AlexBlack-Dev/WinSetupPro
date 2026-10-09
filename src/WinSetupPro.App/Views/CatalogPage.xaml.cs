using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using WinSetupPro.App.ViewModels;

namespace WinSetupPro.App.Views;

public sealed partial class CatalogPage : Page
{
    public CatalogViewModel ViewModel { get; }

    private readonly DispatcherQueueTimer _searchTimer;

    public CatalogPage()
    {
        ViewModel = App.Services.GetRequiredService<CatalogViewModel>();
        InitializeComponent();
        SearchBox.Text = ViewModel.Main.SearchQuery;
        _searchTimer = DispatcherQueue.CreateTimer();
        _searchTimer.Interval = TimeSpan.FromMilliseconds(300);
        _searchTimer.Tick += (t, _) =>
        {
            t.Stop();
            ViewModel.Main.SearchQuery = SearchBox.Text;
        };
        Loaded += (_, _) => HeroEntrance.Begin();
    }

    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        _searchTimer.Stop();
        _searchTimer.Start();
    }

    private void ProfileChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string id })
            ViewModel.Main.ApplyProfileCommand.Execute(id);
    }

    private void Clear_Click(object sender, RoutedEventArgs e) =>
        ViewModel.Main.ClearSelectionCommand.Execute(null);

    private void Install_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.Main.BuildQueueCommand.Execute(null);
        Frame.Navigate(typeof(QueuePage));
    }
}
