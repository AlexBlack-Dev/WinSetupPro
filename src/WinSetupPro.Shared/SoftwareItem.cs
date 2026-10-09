namespace WinSetupPro.Shared;

/// <summary>
/// Single installable application. Immutable record — Senior rule: catalog data never mutates at runtime.
/// <para>Clean-install guarantee: we ONLY invoke the vendor installer via winget/scoop silent switches.
/// No repacks, no bundled toolbars — winget manifests are hash-verified by Microsoft.</para>
/// </summary>
public sealed record SoftwareItem
{
    public required string Id { get; init; }
    public required string NameEn { get; init; }
    public required string NameRu { get; init; }
    public string DescriptionEn { get; init; } = string.Empty;
    public string DescriptionRu { get; init; } = string.Empty;

    /// <summary>Exact winget id, e.g. "Git.Git". Null when scoop-only.</summary>
    public string? WingetId { get; init; }

    /// <summary>Scoop manifest name, e.g. "ripgrep". Null when winget-only.</summary>
    public string? ScoopName { get; init; }

    /// <summary>Shipped brand icon, relative to exe dir, e.g. "icons/git.svg". Null → monogram tile.</summary>
    public string? Icon { get; init; }

    public EngineKind PreferredEngine { get; init; } = EngineKind.Winget;
    public SoftwareCategory Category { get; init; } = SoftwareCategory.Essential;

    /// <summary>Profile ids this app belongs to, e.g. ["base","frontend"].</summary>
    public string[] Profiles { get; init; } = [];

    public bool IsPopular { get; init; }
    public string IconGlyph { get; init; } = "\uE734"; // default app icon

    public string DisplayName(string lang) => lang == "ru" ? NameRu : NameEn;
    public string DisplayDescription(string lang) => lang == "ru" ? DescriptionRu : DescriptionEn;
}
