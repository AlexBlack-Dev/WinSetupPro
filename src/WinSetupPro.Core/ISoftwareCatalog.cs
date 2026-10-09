namespace WinSetupPro.Core;

/// <summary>Read-only catalog access. Implementation loads JSON (Infra), logic stays here.</summary>
public interface ISoftwareCatalog
{
    IReadOnlyList<SoftwareItem> Apps { get; }
    IReadOnlyList<SoftwareProfile> Profiles { get; }
    SoftwareItem? Find(string id);
    IEnumerable<SoftwareItem> Search(string query, string lang);
    IEnumerable<SoftwareItem> ForProfile(string profileId);
}
