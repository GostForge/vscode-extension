/**
 * Все текстовые строки VS Code расширения GostForge.
 * Единый файл для удобного редактирования переводов.
 */

// ── Общие ──

export const EXTENSION_NAME = "GostForge";
export const READY = "готов";
export const ERROR = "Ошибка";
export const DONE = "Готово";

// ── Боковая панель ──

export const PANEL_TITLE = "Панель управления";
export const PANEL_SECTION_SETTINGS = "Настройки";
export const PANEL_SECTION_CONVERT = "Конвертация";
export const PANEL_SECTION_WARNINGS = "Предупреждения конвертации";

export const PANEL_BTN_SET_TOKEN = "Установить токен";
export const PANEL_BTN_SET_URL = "Адрес сервера";
export const PANEL_BTN_CONVERT_DOCX = "Конвертировать MD → DOCX";
export const PANEL_BTN_CONVERT_PDF = "Конвертировать MD → DOCX → PDF";
export const PANEL_BTN_CONVERT_MARKDOWN = "Конвертировать DOCX → Markdown";

export const PANEL_TOKEN_SAVED = "Токен сохранён";
export const PANEL_TOKEN_NOT_SET = "Токен не установлен";
export const PANEL_NO_WARNINGS = "Нет предупреждений";
export const PANEL_SERVER_URL = "Сервер";

// ── Команды (Command Palette) ──

export const CMD_SET_TOKEN_TITLE = "GostForge: Установить API токен";
export const CMD_SET_ENDPOINT_TITLE = "GostForge: Адрес сервера";
export const CMD_CONVERT_DOCX_TITLE = "GostForge: Конвертировать MD → DOCX";
export const CMD_CONVERT_PDF_TITLE = "GostForge: Конвертировать MD → DOCX → PDF";
export const CMD_CONVERT_MARKDOWN_TITLE = "GostForge: Конвертировать DOCX → Markdown";
export const CMD_HISTORY_TITLE = "GostForge: История конвертаций";

// ── Установка токена ──

export const TOKEN_PROMPT = "Введите Personal Access Token (PAT) от GostForge";
export const TOKEN_PLACEHOLDER = "gf_...";
export const TOKEN_SAVED_MSG = "GostForge: Токен сохранён.";
export const TOKEN_MISSING_MSG =
  "Токен не настроен. Нажмите «Установить токен» в боковой панели GostForge.";

// ── Установка сервера ──

export const ENDPOINT_PROMPT = "Введите URL сервера GostForge";
export const ENDPOINT_SAVED_MSG = (url: string) =>
  `GostForge: Адрес сервера изменён на ${url}`;

// ── Конвертация ──

export const CONVERT_NO_PROJECT =
  "Не найден gostforge.yml. Создайте пустой gostforge.yml в корне проекта.";
export const CONVERT_PICK_PROJECT = "Выберите проект для конвертации";
export const CONVERT_SCANNING = "Сканирование файлов...";
export const CONVERT_NO_FILES = "В директории проекта нет файлов.";
export const CONVERT_NO_MD = "Не найден .md файл в директории проекта.";
export const CONVERT_NO_DOCX = "Не найден .docx файл в директории проекта.";
export const CONVERT_CHECKING = (n: number) => `Проверка ${n} файлов...`;
export const CONVERT_UPLOADING = (n: number) => `Загрузка ${n} файлов...`;
export const CONVERT_ALL_CACHED = "Отправка (все файлы в кэше)...";
export const CONVERT_QUEUED = (status: string) => `⏳ В очереди (${status})`;
export const CONVERT_STATUS = (status: string, pos?: number) => {
  const posStr = pos ? ` (#${pos})` : "";
  return `⏳ ${status}${posStr}`;
};
export const CONVERT_DOWNLOADING = (fmt: string) => `Загрузка ${fmt}...`;
export const CONVERT_DOWNLOAD_FAILED = (fmt: string, msg: string) =>
  `Не удалось скачать ${fmt}: ${msg}`;
export const CONVERT_SUCCESS = (outDir: string) =>
  `GostForge: Конвертация завершена! Результат в ${outDir}/`;
export const CONVERT_FAILED = (status: string) =>
  `Конвертация не удалась: ${status}`;
export const CONVERT_ERROR = (msg: string) => `Ошибка GostForge: ${msg}`;

// ── Предупреждения ──

export const WARNINGS_TITLE = "GostForge — Предупреждения";
export const WARNINGS_HEADER = (n: number) =>
  `Конвертация завершена с ${n} предупреждением(ями):`;
export const WARNINGS_SEPARATOR = "─".repeat(50);

// ── История ──

export const HISTORY_EMPTY = "Конвертаций пока нет";
export const HISTORY_VIEW_NAME = "История конвертаций";

// ── Статус бар ──

export const STATUSBAR_READY = "GostForge";
export const STATUSBAR_READY_TOOLTIP = "GostForge — готов";
export const STATUSBAR_DONE = "GostForge: Готово";
export const STATUSBAR_DONE_TOOLTIP = "GostForge — конвертация завершена";
export const STATUSBAR_ERROR = "GostForge: Ошибка";
