using Microsoft.UI.Xaml;
using WinSetupPro.App.Views;

namespace WinSetupPro.App;

/// <summary>Root window: Mica + custom title bar, hosts the navigation shell.</summary>
public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        AppWindow.SetIcon("Assets/AppIcon.ico");
        AppWindow.Title = "WinSetupPro";

        RootFrame.Navigate(typeof(ShellPage));
    }
}
