# WinSetupPro

Чистая установка софта на свежий Windows за один запуск. Выбери профиль (База, Фронтенд, .NET, Python/ИИ, Unity, Офис, Игры) или отметь приложения вручную — всё встанет тихо, официально и без мусора.

Clean software setup for fresh Windows in one run. Pick a profile or select manually — everything installs silently from official vendor binaries. RU/EN UI.

## Почему это чисто

- Только `winget` (основное) + `scoop` (CLI-утилиты): официальные установщики вендоров, hash-проверка манифестов.
- Флаги: `--silent --disable-interactivity --accept-package-agreements`. Никаких репаков, тулбаров и «попутных» программ.
- Уже установленное пропускается (`winget list --exact`), очередь ставится строго последовательно.
- Перед массовой установкой создаётся точка восстановления (best-effort).

## Стек

- **WinUI 3** (Windows App SDK) + **.NET 10**, C# latest, unpackaged portable (без MSIX/сертификата)
- MVVM: `CommunityToolkit.Mvvm`, DI: `Microsoft.Extensions.DependencyInjection`
- Архитектура: `Shared` (DTO) → `Core` (интерфейсы, очередь, профили — чистый, без UI) → `Infra` (Winget/Scoop CLI, JSON-каталог, настройки) → `App` (WinUI)
- Каталог: `catalog/catalog.json` — 115+ приложений, 7 редактируемых профилей

## Сборка и запуск

```powershell
# Требования: Windows 10 21H2+/11, .NET 10 SDK
dotnet build WinSetupPro.slnx -c Release -a x64
dotnet test WinSetupPro.slnx
# Запуск:
.\src\WinSetupPro.App\bin\Release\net10.0-windows10.0.26100.0\win-x64\WinSetupPro.exe
```

Пресеты хранятся в `%AppData%\WinSetupPro\settings.json`, свой каталог можно положить в `%AppData%\WinSetupPro\catalog.json` (перекроет встроенный).

## Защита (честно)

Open-source (MIT). Уровень: честный — официального репозитория, подписанных релизов и проверки hash winget достаточно против подмен. Обфускация IL (ConfuserEx/BitMono) подключается на CI при желании; 100% защиты от реверса не существует.

## Roadmap

- v0.2: версии/пины (`winget pin`), повторная проверка установленных, иконки из CDN
- v0.3: автообновление через Velopack, экспорт `winget import` файла
- v2: деблокировка Win11 (опционально), драйверы, твики
