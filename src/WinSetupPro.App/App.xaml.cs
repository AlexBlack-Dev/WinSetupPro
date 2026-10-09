using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;
using WinSetupPro.App.Services;
using WinSetupPro.App.ViewModels;
using WinSetupPro.App.Views;
using WinSetupPro.Core;
using WinSetupPro.Infra;

namespace WinSetupPro.App;

/// <summary>Composition root. All wiring lives here — pages and VMs stay DI-clean.</summary>
public partial class App : Application
{
    public static ServiceProvider Services { get; private set; } = null!;
    public static Window Window { get; private set; } = null!;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var collection = new ServiceCollection();

        var catalogPath = Path.Combine(AppContext.BaseDirectory, "catalog.json");
        var repo = JsonCatalogRepository.Load(catalogPath);

        collection.AddSingleton<ISoftwareCatalog>(repo.AsCatalog());
        collection.AddSingleton<SettingsStore>();
        collection.AddSingleton<LocalizationService>();
        collection.AddSingleton<ThemeService>();
        collection.AddSingleton<IInstallEngine, WingetEngine>();
        collection.AddSingleton<IInstallEngine, ScoopEngine>();
        collection.AddSingleton<JobRunner>();
        collection.AddSingleton<MainViewModel>();
        collection.AddSingleton<QueueViewModel>();
        collection.AddTransient<CatalogViewModel>();
        collection.AddTransient<SettingsViewModel>();

        Services = collection.BuildServiceProvider();

        // Apply persisted theme + language before first paint.
        var settings = Services.GetRequiredService<SettingsStore>();
        var theme = Services.GetRequiredService<ThemeService>();
        var loc = Services.GetRequiredService<LocalizationService>();
        loc.SetLanguage(settings.Value.Lang);
        theme.Apply(settings.Value.Theme);

        Window = new MainWindow();
        Window.Activate();
    }
}
