using CommunityToolkit.Mvvm.ComponentModel;

namespace WinSetupPro.App.Services;

/// <summary>Instant RU/EN switching, no .resw roundtrip. Persisted via SettingsStore.</summary>
public sealed partial class LocalizationService : ObservableObject
{
    private string _lang = "ru";

    private static readonly Dictionary<string, (string Ru, string En)> Strings = new()
    {
        ["appTitle"] = ("WinSetupPro — чистая установка софта", "WinSetupPro — clean software setup"),
        ["catalog"] = ("Каталог", "Catalog"),
        ["queue"] = ("Очередь", "Queue"),
        ["settings"] = ("Настройки", "Settings"),
        ["search"] = ("Поиск приложений…", "Search apps…"),
        ["profile"] = ("Профиль", "Profile"),
        ["freeMode"] = ("Свободный выбор", "Free selection"),
        ["selected"] = ("Выбрано", "Selected"),
        ["installSelected"] = ("Установить выбранное", "Install selected"),
        ["selectProfile"] = ("Применить профиль", "Apply profile"),
        ["clearSelection"] = ("Сбросить", "Clear"),
        ["runAll"] = ("Запустить всё", "Run all"),
        ["cancel"] = ("Отмена", "Cancel"),
        ["createRestore"] = ("Создать точку восстановления", "Create restore point"),
        ["restoreCreated"] = ("Точка восстановления создана.", "Restore point created."),
        ["restoreFailed"] = ("Не удалось создать точку (нужен админ). Установка продолжится.", "Restore point failed (admin needed). Install will continue."),
        ["language"] = ("Язык", "Language"),
        ["theme"] = ("Тема", "Theme"),
        ["themeSystem"] = ("Системная", "System"),
        ["themeDark"] = ("Тёмная", "Dark"),
        ["themeLight"] = ("Светлая", "Light"),
        ["engines"] = ("Движки установки", "Install engines"),
        ["wingetOk"] = ("Winget доступен", "Winget available"),
        ["wingetMissing"] = ("Winget не найден", "Winget missing"),
        ["scoopOk"] = ("Scoop доступен", "Scoop available"),
        ["scoopMissing"] = ("Scoop не найден (только для CLI-утилит)", "Scoop missing (CLI tools only)"),
        ["exportPreset"] = ("Экспорт пресета", "Export preset"),
        ["importPreset"] = ("Импорт пресета", "Import preset"),
        ["about"] = ("Open-source (MIT). Движки: Winget + Scoop. Только официальные установщики, silent-режим, hash-проверка — без бандлов и мусора.", "Open-source (MIT). Engines: Winget + Scoop. Official installers only, silent mode, hash check — no bundles, no junk."),
        ["heroTitle"] = ("Чистый Windows за один запуск", "A clean Windows in one run"),
        ["heroSubtitle"] = ("Выбери профиль или отметь вручную — всё встанет тихо и без мусора", "Pick a profile or select manually — everything installs silently and cleanly"),
        ["alreadyInstalled"] = ("Уже стоит — пропустим", "Already installed — will skip"),
        ["statusQueued"] = ("В очереди", "Queued"),
        ["statusRunning"] = ("Ставится…", "Installing…"),
        ["statusDone"] = ("Готово", "Done"),
        ["statusFailed"] = ("Ошибка", "Failed"),
        ["statusSkipped"] = ("Пропущено", "Skipped"),
        ["logPlaceholder"] = ("Лог появится здесь во время установки…", "Log will appear here during install…"),
        ["footerHint"] = ("Тихо · Официально · Без мусора", "Silent · Official · No junk"),
        ["emptyCatalog"] = ("Ничего не найдено — попробуй другой запрос", "Nothing found — try another query"),
        ["emptyQueue"] = ("Очередь пуста — выбери приложения в каталоге", "Queue is empty — pick apps in the catalog"),
        ["backToCatalog"] = ("К каталогу", "To catalog"),
        ["apps"] = ("приложений", "apps"),
        ["profilesWord"] = ("профилей", "profiles"),
        ["needAdmin"] = ("Для установки нужен запуск от администратора — иначе часть программ не встанет", "Run as administrator to install — otherwise some apps will fail"),
        ["restartAdmin"] = ("Перезапустить как админ", "Restart as admin"),
        ["removeJob"] = ("Убрать", "Remove"),
        ["clearFinished"] = ("Очистить готовые", "Clear done"),
        ["installScoop"] = ("Установить Scoop", "Install Scoop"),
    };

    public string Lang => _lang;

    public void SetLanguage(string lang)
    {
        _lang = lang == "en" ? "en" : "ru";
        OnPropertyChanged(nameof(Lang));
        // Notify every L[...] binding.
        OnPropertyChanged(string.Empty);
    }

    public string this[string key] =>
        Strings.TryGetValue(key, out var v) ? (_lang == "ru" ? v.Ru : v.En) : key;

    /// <summary>x:Bind-compatible accessor (the XAML compiler cannot parse indexers in bind paths).</summary>
    public string Get(string key) => this[key];
}
