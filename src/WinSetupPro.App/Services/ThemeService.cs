using Microsoft.UI.Xaml;

namespace WinSetupPro.App.Services;

/// <summary>system | dark | light, applied to the root window before paint.</summary>
public sealed class ThemeService
{
    public void Apply(string theme)
    {
        if (App.Window?.Content is not FrameworkElement root)
            return;

        root.RequestedTheme = theme switch
        {
            "dark" => ElementTheme.Dark,
            "light" => ElementTheme.Light,
            _ => ElementTheme.Default,
        };
    }
}
