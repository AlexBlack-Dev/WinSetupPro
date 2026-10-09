using System.Text.Json;
using System.Text.Json.Serialization;

namespace WinSetupPro.Infra;

/// <summary>User settings: language, theme, selection, per-profile edits. Single small JSON file.</summary>
public sealed record AppSettings
{
    public string Lang { get; set; } = "ru";
    public string Theme { get; set; } = "system"; // system | dark | light
    public HashSet<string> SelectedIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, ProfileEdit> ProfileEdits { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed record ProfileEdit
{
    public HashSet<string> Added { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<string> Removed { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

[JsonSourceGenerationOptions(WriteIndented = true)]
[JsonSerializable(typeof(AppSettings))]
internal partial class SettingsJsonContext : JsonSerializerContext;

public sealed class SettingsStore
{
    private readonly string _path;
    public AppSettings Value { get; private set; } = new();

    public SettingsStore()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "WinSetupPro");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "settings.json");
        Load();
    }

    private void Load()
    {
        try
        {
            if (File.Exists(_path))
                Value = JsonSerializer.Deserialize(File.ReadAllText(_path), SettingsJsonContext.Default.AppSettings) ?? new();
        }
        catch { Value = new(); }
    }

    public void Save()
    {
        try { File.WriteAllText(_path, JsonSerializer.Serialize(Value, SettingsJsonContext.Default.AppSettings)); }
        catch { /* settings must never crash the app */ }
    }
}
