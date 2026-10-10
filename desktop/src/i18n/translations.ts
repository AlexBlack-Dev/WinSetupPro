export type Lang = "ru" | "en";

type Pair = [ru: string, en: string];

const dict: Record<string, Pair> = {
  appTitle: ["WinSetupPro — чистая установка софта", "WinSetupPro — clean software setup"],
  catalog: ["Каталог", "Catalog"],
  queue: ["Очередь", "Queue"],
  settings: ["Настройки", "Settings"],
  search: ["Поиск приложений…", "Search apps…"],
  profile: ["Профиль", "Profile"],
  selected: ["Выбрано", "Selected"],
  installSelected: ["Установить выбранное", "Install selected"],
  clearSelection: ["Сбросить", "Clear"],
  runAll: ["Запустить всё", "Run all"],
  cancel: ["Отмена", "Cancel"],
  createRestore: ["Создать точку восстановления", "Create restore point"],
  restoreCreated: ["Точка восстановления создана.", "Restore point created."],
  restoreFailed: [
    "Не удалось создать точку (нужен админ). Установка продолжится.",
    "Restore point failed (admin needed). Install will continue.",
  ],
  language: ["Язык", "Language"],
  theme: ["Тема", "Theme"],
  themeSystem: ["Системная", "System"],
  themeDark: ["Тёмная", "Dark"],
  themeLight: ["Светлая", "Light"],
  accent: ["Акцент", "Accent"],
  engines: ["Движки установки", "Install engines"],
  wingetOk: ["Winget доступен", "Winget available"],
  wingetMissing: ["Winget не найден", "Winget missing"],
  scoopOk: ["Scoop доступен", "Scoop available"],
  scoopMissing: ["Scoop не найден (только для CLI-утилит)", "Scoop missing (CLI tools only)"],
  installScoop: ["Установить Scoop", "Install Scoop"],
  exportPreset: ["Экспорт пресета", "Export preset"],
  importPreset: ["Импорт пресета", "Import preset"],
  about: [
    "Open-source (MIT) · Winget + Scoop · официальные установщики, silent, hash-проверка.",
    "Open-source (MIT) · Winget + Scoop · official installers, silent, hash-checked.",
  ],
  heroTitle: ["Чистый Windows за один запуск", "A clean Windows in one run"],
  heroSubtitle: [
    "Выбери профиль или отметь вручную — всё встанет тихо и без мусора",
    "Pick a profile or select manually — everything installs silently and cleanly",
  ],
  statusQueued: ["В очереди", "Queued"],
  statusRunning: ["Ставится…", "Installing…"],
  statusDone: ["Готово", "Done"],
  statusFailed: ["Ошибка", "Failed"],
  statusSkipped: ["Пропущено", "Skipped"],
  statusCancelled: ["Отменено", "Cancelled"],
  emptyCatalog: ["Ничего не найдено — попробуй другой запрос", "Nothing found — try another query"],
  emptyQueue: ["Очередь пуста — выбери приложения в каталоге", "Queue is empty — pick apps in the catalog"],
  backToCatalog: ["К каталогу", "To catalog"],
  installedBadge: ["Уже установлено — будет пропущено", "Already installed — will be skipped"],
  apps: ["приложений", "apps"],
  profilesWord: ["профилей", "profiles"],
  needAdmin: [
    "Для установки нужен запуск от администратора — иначе часть программ не встанет",
    "Run as administrator to install — otherwise some apps will fail",
  ],
  restartAdmin: ["Перезапустить как админ", "Restart as admin"],
  removeJob: ["Убрать", "Remove"],
  clearFinished: ["Очистить готовые", "Clear done"],
  installed: ["Установлено", "Installed"],
  refresh: ["Обновить", "Refresh"],
  fromCatalog: ["Из каталога", "From catalog"],
  otherApps: ["Остальное", "Other"],
  scanning: ["Сканирую систему…", "Scanning system…"],
};

export type Dict = typeof dict;

export const translations: Record<Lang, Record<string, string>> = {
  ru: Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, v[0]])),
  en: Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, v[1]])),
};

const STATUS: Record<string, string> = {
  queued: "statusQueued",
  running: "statusRunning",
  succeeded: "statusDone",
  failed: "statusFailed",
  skipped: "statusSkipped",
  cancelled: "statusCancelled",
};

export function statusKey(status: string): string {
  return STATUS[status] ?? status;
}

export function statusText(lang: Lang, status: string): string {
  const key = statusKey(status);
  return translations[lang][key] ?? status;
}
