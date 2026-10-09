using WinSetupPro.Core;
using WinSetupPro.Infra;
using WinSetupPro.Shared;

namespace WinSetupPro.Core.Tests;

/// <summary>Guards the curated catalog: size, integrity, profile wiring.</summary>
public sealed class CatalogTests
{
    private static string FindCatalog()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "catalog", "catalog.json");
            if (File.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }
        throw new FileNotFoundException("catalog/catalog.json not found above test bin dir.");
    }

    private static ISoftwareCatalog Load() =>
        JsonCatalogRepository.Load(FindCatalog()).AsCatalog();

    [Fact]
    public void Catalog_Has_Substantial_Size()
    {
        var catalog = Load();
        Assert.True(catalog.Apps.Count >= 100, $"Expected 100+ apps, got {catalog.Apps.Count}.");
        Assert.True(catalog.Profiles.Count >= 6, $"Expected 6+ profiles, got {catalog.Profiles.Count}.");
    }

    [Fact]
    public void Catalog_Has_No_Duplicate_Ids()
    {
        var catalog = Load();
        var dupes = catalog.Apps.GroupBy(a => a.Id, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        Assert.Empty(dupes);
    }

    [Fact]
    public void Every_App_Has_An_Engine()
    {
        var catalog = Load();
        var broken = catalog.Apps
            .Where(a => string.IsNullOrWhiteSpace(a.WingetId) && string.IsNullOrWhiteSpace(a.ScoopName))
            .Select(a => a.Id).ToList();
        Assert.Empty(broken);
    }

    [Fact]
    public void Every_Profile_AppId_Resolves()
    {
        var catalog = Load();
        var missing = catalog.Profiles
            .SelectMany(p => p.AppIds.Select(id => (Profile: p.Id, App: id)))
            .Where(x => catalog.Find(x.App) is null).ToList();
        Assert.Empty(missing);
    }

    [Fact]
    public void Declared_Icons_Exist_On_Disk()
    {
        var catalog = Load();
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "catalog", "catalog.json")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var broken = catalog.Apps
            .Where(a => a.Icon is not null && !File.Exists(Path.Combine(dir.FullName, "catalog", a.Icon)))
            .Select(a => a.Id).ToList();
        Assert.Empty(broken);
    }

    [Fact]
    public void ProfileService_Resolve_Applies_Edits()
    {
        var catalog = Load();
        var baseCount = catalog.ForProfile("base").Count();

        var resolved = ProfileService.Resolve(catalog, "base",
            added: new HashSet<string>(["git"], StringComparer.OrdinalIgnoreCase),
            removed: new HashSet<string>(StringComparer.OrdinalIgnoreCase));

        Assert.Contains(resolved, a => a.Id.Equals("git", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(baseCount + (catalog.ForProfile("base").Any(a => a.Id == "git") ? 0 : 1), resolved.Count);
    }

    [Fact]
    public void ProfileService_Unknown_Profile_Returns_Empty()
    {
        var catalog = Load();
        Assert.Empty(ProfileService.Resolve(catalog, "no-such-profile"));
    }
}
