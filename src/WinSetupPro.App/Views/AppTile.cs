using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace WinSetupPro.App.Views;

/// <summary>Shared tile visual: real shipped icon when present, gradient monogram otherwise.</summary>
public sealed class AppTile
{
    public string Text { get; }
    public Uri? IconUri { get; }
    public bool HasIcon => IconUri is not null;
    public Brush Background { get; }

    public AppTile(SoftwareItem item)
    {
        Text = CategoryTile.Letters(item.NameEn);
        var iconFile = item.Icon is null ? null : Path.Combine(AppContext.BaseDirectory, item.Icon);
        if (iconFile is not null && File.Exists(iconFile))
        {
            IconUri = new Uri(iconFile);
            Background = new SolidColorBrush(Color.FromArgb(0xFF, 0xF1, 0xF5, 0xF9));
        }
        else
        {
            Background = CategoryTile.MakeBrush(item.Category);
        }
    }
}
