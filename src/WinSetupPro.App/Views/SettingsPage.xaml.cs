using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using WinRT.Interop;
using WinSetupPro.App.ViewModels;
using WinSetupPro.Infra;

namespace WinSetupPro.App.Views;

[JsonSerializable(typeof(HashSet<string>))]
internal partial class PresetJsonContext : JsonSerializerContext { }

public sealed partial class SettingsPage : Page
{
    public SettingsViewModel ViewModel { get; }

    public SettingsPage()
    {
        ViewModel = App.Services.GetRequiredService<SettingsViewModel>();
        InitializeComponent();

        LangBox.ItemsSource = ViewModel.Languages;
        LangBox.SelectedItem = ViewModel.SelectedLang;
        ThemeBox.ItemsSource = ViewModel.Themes;
        ThemeBox.SelectedItem = ViewModel.SelectedTheme;

        Loaded += async (_, _) => await ViewModel.RefreshEnginesAsync();
    }

    private void LangBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LangBox.SelectedItem is string lang && lang != ViewModel.SelectedLang)
            ViewModel.SelectedLang = lang;
    }

    private void ThemeBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (ThemeBox.SelectedItem is string theme && theme != ViewModel.SelectedTheme)
            ViewModel.SelectedTheme = theme;
    }

    private static void InitPicker(object picker)
    {
        var hwnd = WindowNative.GetWindowHandle(App.Window);
        InitializeWithWindow.Initialize(picker, hwnd);
    }

    private async void Export_Click(object sender, RoutedEventArgs e)
    {
        var picker = new Windows.Storage.Pickers.FileSavePicker
        {
            SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.DocumentsLibrary,
            SuggestedFileName = "winsetuppro-preset",
        };
        picker.FileTypeChoices.Add("JSON", [".json"]);
        InitPicker(picker);

        if (await picker.PickSaveFileAsync() is { } file)
        {
            var store = App.Services.GetRequiredService<SettingsStore>();
            var json = JsonSerializer.Serialize(store.Value.SelectedIds, PresetJsonContext.Default.HashSetString);
            await Windows.Storage.FileIO.WriteTextAsync(file, json);
            ViewModel.StatusLine = file.Path;
        }
    }

    private async void Import_Click(object sender, RoutedEventArgs e)
    {
        var picker = new Windows.Storage.Pickers.FileOpenPicker
        {
            SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.DocumentsLibrary,
        };
        picker.FileTypeFilter.Add(".json");
        InitPicker(picker);

        if (await picker.PickSingleFileAsync() is { } file)
        {
            try
            {
                var json = await Windows.Storage.FileIO.ReadTextAsync(file);
                var ids = JsonSerializer.Deserialize(json, PresetJsonContext.Default.HashSetString) ?? [];
                var store = App.Services.GetRequiredService<SettingsStore>();
                var main = App.Services.GetRequiredService<MainViewModel>();
                foreach (var app in main.AllApps)
                    app.IsSelected = ids.Contains(app.Item.Id);
                ViewModel.StatusLine = file.Path;
            }
            catch (Exception ex)
            {
                ViewModel.StatusLine = ex.Message;
            }
        }
    }

    private async void Restore_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.StatusLine = ViewModel.Loc["createRestore"] + "…";
        var ok = await RestorePointService.TryCreateAsync("WinSetupPro manual");
        ViewModel.StatusLine = ok ? ViewModel.Loc["restoreCreated"] : ViewModel.Loc["restoreFailed"];
    }
}
