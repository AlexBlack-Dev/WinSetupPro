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
  uninstall: ["Удалить", "Uninstall"],
  uninstallConfirm: [
    "Удалить приложение штатным uninstaller, затем предложить зачистку остатков?",
    "Remove the app with its uninstaller, then offer leftover cleanup?",
  ],
  uninstallBusy: ["Удаляется…", "Uninstalling…"],
  uninstallDone: ["Удалено.", "Uninstalled."],
  uninstallFailed: ["Не удалось удалить.", "Uninstall failed."],
  leftoversConfirm: ["Найдены остатки. Удалить их из реестра и папок?", "Leftovers found. Delete them from registry and folders?"],
  leftoversCleaned: ["Остатки зачищены.", "Leftovers cleaned."],
  leftoversKept: ["Остатки оставлены.", "Leftovers kept."],
  optimize: ["Оптимизация", "Optimize"],
  sysInfo: ["Система", "System"],
  processes: ["Процессы", "Processes"],
  startup: ["Автозагрузка", "Startup"],
  cleanup: ["Очистка", "Cleanup"],
  tweaks: ["Твики", "Tweaks"],
  kill: ["Завершить", "Kill"],
  killConfirm: ["Завершить процесс? Несистемные процессы безопасны.", "Kill this process? Non-system processes are safe."],
  disable: ["Отключить", "Disable"],
  disableConfirm: ["Убрать из автозагрузки?", "Remove from startup?"],
  apply: ["Применить", "Apply"],
  revert: ["Откатить", "Revert"],
  clean: ["Очистить", "Clean"],
  cleanConfirm: ["Удалить временные файлы?", "Delete temporary files?"],
  defender: ["Защитник", "Defender"],
  needAdminTweak: ["Нужен админ", "Needs admin"],
  tweakOn: ["Вкл", "On"],
  tweakOff: ["Выкл", "Off"],
  updateCheck: ["Проверить обновления", "Check for updates"],
  checkingUpdates: ["Проверяю…", "Checking…"],
  updateLatest: ["Установлена последняя версия.", "You have the latest version."],
  download: ["Скачать", "Download"],
  reportIssue: ["Сообщить о проблеме", "Report an issue"],
  openLogs: ["Папка логов", "Logs folder"],
  logSaved: ["Лог запуска сохраняется на диск.", "Run logs are saved to disk."],
  catalogUpdated: ["Каталог обновлен", "Catalog updated"],
  developer: ["Разработчик", "Developer"],
  data: ["Данные", "Data"],
  version: ["Версия", "Version"],
  backups: ["Бэкапы автозагрузки", "Startup backups"],
  restore: ["Восстановить", "Restore"],
  restored: ["Восстановлено.", "Restored."],
  backupEmpty: ["Пока пусто — бэкап пишется при каждом отключении.", "Empty yet — a backup is written on every disable."],
  safetyTitle: ["Почему это безопасно", "Why this is safe"],
  safety1: ["Открытый код: каждая кнопка делает ровно то, что написано", "Open source: every button does exactly what it says"],
  safety2: ["Бэкапы: автозагрузка копируется перед отключением", "Backups: startup entries are copied before disabling"],
  safety3: ["Allowlist: реестр правится только в разрешенных ветках", "Allowlist: registry is touched only in allowed branches"],
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
