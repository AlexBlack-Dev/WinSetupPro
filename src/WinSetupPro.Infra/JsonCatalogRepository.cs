using System.Text.Json;
using System.Text.Json.Serialization;

namespace WinSetupPro.Infra;

/// <summary>Catalog file root.</summary>
public sealed record CatalogRoot(SoftwareItem[] Apps, SoftwareProfile[] Profiles);

[JsonSourceGenerationOptions(PropertyNameCaseInsensitive = true, WriteIndented = true)]
[JsonSerializable(typeof(CatalogRoot))]
[JsonSerializable(typeof(SoftwareItem))]
[JsonSerializable(typeof(SoftwareProfile))]
internal partial class CatalogJsonContext : JsonSerializerContext;

/// <summary>Loads catalog.json (user override in %AppData% wins, else shipped file). AOT-safe via source-gen.</summary>
public sealed class JsonCatalogRepository
{
    private readonly CatalogRoot _root;
    private JsonCatalogRepository(CatalogRoot root) => _root = root;

    public static JsonCatalogRepository Load(string shippedPath)
    {
        var overridePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "WinSetupPro", "catalog.json");

        var path = File.Exists(overridePath) ? overridePath : shippedPath;
        if (!File.Exists(path))
            return new JsonCatalogRepository(new CatalogRoot([], []));

        var json = File.ReadAllText(path);
        var root = JsonSerializer.Deserialize(json, CatalogJsonContext.Default.CatalogRoot)
                   ?? new CatalogRoot([], []);
        return new JsonCatalogRepository(root);
    }

    public CatalogImpl AsCatalog() => new(_root.Apps, _root.Profiles);

    public sealed class CatalogImpl(IReadOnlyList<SoftwareItem> apps, IReadOnlyList<SoftwareProfile> profiles) : ISoftwareCatalog
    {
        public IReadOnlyList<SoftwareItem> Apps { get; } = apps;
        public IReadOnlyList<SoftwareProfile> Profiles { get; } = profiles;

        public SoftwareItem? Find(string id) =>
            Apps.FirstOrDefault(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));

        public IEnumerable<SoftwareItem> Search(string query, string lang)
        {
            if (string.IsNullOrWhiteSpace(query)) return Apps;
            return Apps.Where(a =>
                a.DisplayName(lang).Contains(query, StringComparison.OrdinalIgnoreCase) ||
                a.Id.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                (a.WingetId?.Contains(query, StringComparison.OrdinalIgnoreCase) ?? false));
        }

        public IEnumerable<SoftwareItem> ForProfile(string profileId) =>
            Profiles.FirstOrDefault(p => p.Id.Equals(profileId, StringComparison.OrdinalIgnoreCase)) is { } profile
                ? profile.AppIds.Select(Find).Where(a => a is not null).Cast<SoftwareItem>()
                : [];
    }
}
