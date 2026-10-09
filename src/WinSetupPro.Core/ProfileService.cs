namespace WinSetupPro.Core;

/// <summary>Pure profile logic: expand profile → items, diff user edits. No IO.</summary>
public static class ProfileService
{
    public static IReadOnlyList<SoftwareItem> Resolve(
        ISoftwareCatalog catalog,
        string profileId,
        IReadOnlySet<string>? added = null,
        IReadOnlySet<string>? removed = null)
    {
        var base_ids = catalog.ForProfile(profileId).Select(a => a.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (added is not null) foreach (var id in added) base_ids.Add(id);
        if (removed is not null) foreach (var id in removed) base_ids.Remove(id);

        return [.. base_ids.Select(catalog.Find).Where(a => a is not null).Cast<SoftwareItem>()];
    }

    public static IReadOnlyList<SoftwareItem> MergeFreeSelection(
        ISoftwareCatalog catalog, IEnumerable<string> selectedIds)
    {
        var set = new HashSet<string>(selectedIds, StringComparer.OrdinalIgnoreCase);
        return [.. set.Select(catalog.Find).Where(a => a is not null).Cast<SoftwareItem>()];
    }
}
