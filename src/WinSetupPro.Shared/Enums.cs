using System.Text.Json.Serialization;

namespace WinSetupPro.Shared;

/// <summary>Installation backend. Winget is primary (clean, official vendor binaries + hash check).</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EngineKind
{
    Winget,
    Scoop
}

/// <summary>Software category for grouping in catalog UI.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SoftwareCategory
{
    Essential,
    Browser,
    DevCore,
    Frontend,
    Backend,
    PythonAi,
    Gamedev,
    Design3D,
    Office,
    Media,
    Gaming,
    Network,
    Utilities,
    Runtime
}
