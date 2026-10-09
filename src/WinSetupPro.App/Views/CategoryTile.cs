using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace WinSetupPro.App.Views;

/// <summary>
/// Cohesive tile system: bold monogram letters on a per-category gradient.
/// One blue family (matches the cube logo) so colors always match.
/// Internal on purpose: keeps the XAML type-info generator away from tuples/statics.
/// </summary>
internal static class CategoryTile
{
    public static (string From, string To) Colors(SoftwareCategory category) => category switch
    {
        SoftwareCategory.Browser => ("#0284C7", "#38BDF8"),
        SoftwareCategory.DevCore => ("#4338CA", "#818CF8"),
        SoftwareCategory.Frontend => ("#0369A1", "#22D3EE"),
        SoftwareCategory.Backend => ("#1E40AF", "#60A5FA"),
        SoftwareCategory.PythonAi => ("#0E7490", "#22D3EE"),
        SoftwareCategory.Gamedev => ("#1E3A8A", "#3B82F6"),
        SoftwareCategory.Design3D => ("#3730A3", "#60A5FA"),
        SoftwareCategory.Office => ("#2563EB", "#93C5FD"),
        SoftwareCategory.Media => ("#0C4A6E", "#38BDF8"),
        SoftwareCategory.Gaming => ("#312E81", "#818CF8"),
        SoftwareCategory.Network => ("#075985", "#38BDF8"),
        SoftwareCategory.Utilities => ("#475569", "#94A3B8"),
        SoftwareCategory.Runtime => ("#334155", "#64748B"),
        _ => ("#1D4ED8", "#3B82F6"),
    };

    public static LinearGradientBrush MakeBrush(SoftwareCategory category)
    {
        var (from, to) = Colors(category);
        return new LinearGradientBrush
        {
            StartPoint = new Windows.Foundation.Point(0, 0),
            EndPoint = new Windows.Foundation.Point(1, 1),
            GradientStops =
            [
                new GradientStop { Offset = 0, Color = Parse(from) },
                new GradientStop { Offset = 1, Color = Parse(to) },
            ],
        };
    }

    public static Color Parse(string hex)
    {
        var u = Convert.ToUInt32(hex.TrimStart('#'), 16);
        return hex.TrimStart('#').Length <= 6
            ? Color.FromArgb(0xFF, (byte)(u >> 16), (byte)(u >> 8), (byte)u)
            : Color.FromArgb((byte)(u >> 24), (byte)(u >> 16), (byte)(u >> 8), (byte)u);
    }

    /// <summary>1–2 bold letters from the English name: "Visual Studio" → "VS", "7-Zip" → "7Z".</summary>
    public static string Letters(string name)
    {
        var chars = name.Split([' ', '-', '_', '.'], StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.FirstOrDefault(char.IsLetterOrDigit))
            .Where(c => c != default)
            .Take(2)
            .ToArray();
        return chars.Length == 0 ? "?" : new string(chars).ToUpperInvariant();
    }

    public static string CategoryName(SoftwareCategory category, string lang)
    {
        var ru = lang == "ru";
        return category switch
        {
            SoftwareCategory.Essential => ru ? "База" : "Essential",
            SoftwareCategory.Browser => ru ? "Браузеры" : "Browsers",
            SoftwareCategory.DevCore => ru ? "Разработка" : "Dev core",
            SoftwareCategory.Frontend => ru ? "Фронтенд" : "Frontend",
            SoftwareCategory.Backend => ru ? "Бэкенд" : "Backend",
            SoftwareCategory.PythonAi => ru ? "Python и ИИ" : "Python & AI",
            SoftwareCategory.Gamedev => ru ? "Геймдев" : "Gamedev",
            SoftwareCategory.Design3D => ru ? "Дизайн и 3D" : "Design & 3D",
            SoftwareCategory.Office => ru ? "Офис" : "Office",
            SoftwareCategory.Media => ru ? "Медиа" : "Media",
            SoftwareCategory.Gaming => ru ? "Игры" : "Gaming",
            SoftwareCategory.Network => ru ? "Сеть" : "Network",
            SoftwareCategory.Utilities => ru ? "Утилиты" : "Utilities",
            SoftwareCategory.Runtime => ru ? "Рантаймы" : "Runtimes",
            _ => category.ToString(),
        };
    }
}
