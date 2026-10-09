namespace WinSetupPro.Shared;

/// <summary>Curated preset. Users can edit (add/remove apps) — edits stored separately in user settings.</summary>
public sealed record SoftwareProfile
{
    public required string Id { get; init; }
    public required string NameEn { get; init; }
    public required string NameRu { get; init; }
    public string IconGlyph { get; init; } = "\uE7B8";
    public string[] AppIds { get; init; } = [];

    public string DisplayName(string lang) => lang == "ru" ? NameRu : NameEn;
}
