using System.Security.Principal;

namespace WinSetupPro.Infra;

/// <summary>Elevation helpers. Most winget installs need admin; warn instead of failing silently.</summary>
public static class Privilege
{
    public static bool IsAdmin()
    {
        try
        {
            using var id = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch { return false; }
    }

    public static string ExePath()
    {
        var path = Environment.ProcessPath;
        if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            return path;
        return Path.Combine(AppContext.BaseDirectory, "WinSetupPro.exe");
    }
}
