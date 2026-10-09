using WinSetupPro.Core;
using WinSetupPro.Infra;
using WinSetupPro.Shared;

namespace WinSetupPro.Core.Tests;

/// <summary>Integration against the real winget on this machine. Read-only: no installs performed.</summary>
public sealed class EngineTests
{
    private static SoftwareItem SevenZip() => new()
    {
        Id = "7zip",
        NameEn = "7-Zip",
        NameRu = "7-Zip",
        WingetId = "7zip.7zip",
    };

    [Fact]
    public async Task Winget_IsAvailable()
    {
        Assert.True(await new WingetEngine().IsAvailableAsync());
    }

    [Fact]
    public async Task Winget_Sees_Installed_App()
    {
        Assert.True(await new WingetEngine().IsInstalledAsync(SevenZip()));
    }

    [Fact]
    public async Task Winget_Reports_Missing_App_As_Not_Installed()
    {
        var ghost = SevenZip() with { Id = "ghost", WingetId = "NoSuch.Vendor123" };
        Assert.False(await new WingetEngine().IsInstalledAsync(ghost));
    }

    [Fact]
    public async Task JobRunner_Skips_AlreadyInstalled()
    {
        var item = SevenZip();
        var catalog = new JsonCatalogRepository.CatalogImpl([item], []);
        var runner = new JobRunner(catalog, [new WingetEngine(), new ScoopEngine()]);
        var job = new InstallJob(item.Id);

        var events = new List<InstallEvent>();
        var status = await runner.RunAsync(job, events.Add);

        Assert.Equal(InstallStatus.Skipped, status);
        Assert.Contains(events, e => e.Kind == InstallEventKind.Success);
    }

    [Fact]
    public async Task JobRunner_Fails_Unknown_Id()
    {
        var catalog = new JsonCatalogRepository.CatalogImpl([], []);
        var runner = new JobRunner(catalog, [new WingetEngine()]);
        var status = await runner.RunAsync(new InstallJob("nope"));
        Assert.Equal(InstallStatus.Failed, status);
    }
}
