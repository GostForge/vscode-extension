# GostForge — расширение для VS Code

Расширение VS Code для конвертации Markdown-документов в DOCX/PDF по ГОСТ прямо из редактора через backend GostForge.

## Требования

- VS Code 1.85+
- Node.js 18+
- Запущенный backend GostForge (локально или удалённо)
- Personal Access Token (PAT), созданный в веб-интерфейсе GostForge

## Быстрый старт

### 1) Сборка расширения

```bash
cd vscode-extension

# Установка зависимостей
npm install

# Компиляция TypeScript
npm run compile

# Упаковка в .vsix
npx @vscode/vsce package --no-dependencies
```

В результате появится файл `gostforge-0.1.0.vsix`.

### 2) Установка в VS Code

**Через VSIX-файл:**

```bash
code --install-extension gostforge-0.1.0.vsix
```

Либо через UI: `Ctrl+Shift+P` → **Extensions: Install from VSIX...** → выбрать файл.

**Режим разработки (без упаковки):**

Откройте папку `vscode-extension` в VS Code и нажмите **F5** — откроется новое окно Extension Development Host.

### 3) Настройка

После установки откройте боковую панель **GostForge** в Activity Bar.

1. Нажмите кнопку **«Установить токен»** и вставьте PAT.
2. Нажмите кнопку **«Адрес сервера»**, если backend не на `http://localhost:8080`.

Токен хранится в зашифрованном `SecretStorage` VS Code и не попадает в `settings.json` и git.

## Использование

### Структура проекта

Расширение ищет файл `gostforge.yml` в рабочей области. Папка, где он находится (файл может быть пустым), считается корнем проекта для конвертации.

```text
my-report/
├── gostforge.yml        ← маркер проекта (может быть пустым)
├── report.md            ← основной Markdown-документ
├── introduction.md      ← дополнительные секции
├── images/
│   ├── diagram.png
│   └── schema.svg
└── out/                 ← папка результата (создаётся автоматически)
    ├── result.docx
    └── result.pdf
```

**Что НЕ загружается:**
- `gostforge.yml`
- папка `out/` и её содержимое
- вложенные директории, где есть собственный `gostforge.yml` (считаются отдельными проектами)
- всё, что подходит под `gostforge.exclude` (по умолчанию: `node_modules/**`, `.git/**`, `out/**`)

### Запуск конвертации

Через боковую панель **GostForge**:
- **«Конвертировать в DOCX»**
- **«Конвертировать в PDF»**
- **«Конвертировать в DOCX + PDF»**

Если в workspace несколько `gostforge.yml`, появится выбор проекта.

Дальше расширение:
1. Сканирует файлы проекта и считает SHA-256
2. Проверяет, каких файлов нет в кэше сервера (`POST /check-hashes`)
3. Загружает только отсутствующие файлы + полный manifest
4. Показывает прогресс в status bar
5. Скачивает результат в `out/`

Итоговые файлы: `out/result.docx` и/или `out/result.pdf`.

### Предупреждения конвертации

Если `md2gost` вернул предупреждения:
- они отображаются в секции **«Предупреждения конвертации»** на боковой панели;
- также дублируются в Output Channel: **GostForge — Предупреждения**.

## Настройки

| Настройка | По умолчанию | Описание |
|-----------|--------------|----------|
| `gostforge.serverUrl` | `http://localhost:8080` | URL backend GostForge |
| `gostforge.outputFormat` | `DOCX` | Формат по умолчанию: `DOCX`, `PDF`, `BOTH` |
| `gostforge.exclude` | `[`"node_modules/**"`, `".git/**"`, `"out/**"`]` | Glob-паттерны исключения |

Пример `.vscode/settings.json`:

```json
{
  "gostforge.serverUrl": "https://gostforge.example.com",
  "gostforge.outputFormat": "BOTH",
  "gostforge.exclude": [
    "node_modules/**",
    ".git/**",
    "out/**",
    "drafts/**",
    "*.tmp"
  ]
}
```

## Команды Command Palette

Кнопки в боковой панели покрывают основной сценарий, но команды также доступны в Command Palette:

| Команда | Описание |
|---------|----------|
| `GostForge: Установить API токен` | Сохранить PAT в SecretStorage |
| `GostForge: Адрес сервера` | Изменить URL backend |
| `GostForge: Конвертировать в DOCX` | Конвертация проекта в DOCX |
| `GostForge: Конвертировать в PDF` | Конвертация проекта в PDF |
| `GostForge: Конвертировать в DOCX + PDF` | Конвертация в оба формата |
| `GostForge: История конвертаций` | Открыть дерево истории |

## Status Bar

| Отображение | Состояние |
|-------------|-----------|
| `$(file-text) GostForge` | Режим ожидания |
| `$(sync~spin) Сканирование файлов...` | Сканирование проекта |
| `$(sync~spin) Загрузка 3 файлов...` | Загрузка файлов на сервер |
| `$(sync~spin) ⏳ CONVERTING_DOCX` | Идёт конвертация на сервере |
| `$(check) GostForge: Готово` | Успешно завершено |
| `$(error) GostForge: Ошибка` | Ошибка |

## Markdown-сниппеты

В `.md`-файлах доступны:

| Префикс | Вставка |
|---------|---------|
| `gtoc` | `[TOC]` — оглавление |
| `gimg` | Изображение с подписью и именем ссылки |
| `gcode` | Листинг кода с путём до файла |
| `gref` | Кросс-ссылка на рисунок/таблицу |
| `gformula` | Блок формулы LaTeX |
| `gpagebreak` | Разрыв страницы |

## Как работает hash-кэширование

Расширение не загружает повторно неизменённые файлы:

1. Для каждого файла проекта считается SHA-256
2. Все хэши отправляются в `POST /api/v1/convert/quick/check-hashes`
3. Сервер возвращает только пути, отсутствующие в CAS
4. Клиент загружает только эти файлы + полный manifest
5. Сервер валидирует хэши и собирает полный workspace

Если между `check-hashes` и `submit` часть кэша была удалена, сервер вернёт `409 STALE_CACHE`, расширение автоматически повторит попытку (до 2 раз).

## Структура исходников

```text
vscode-extension/
├── package.json              # Манифест расширения (команды, настройки, views)
├── tsconfig.json             # Конфиг TypeScript
├── .vscodeignore             # Исключения из .vsix
└── src/
    ├── extension.ts          # Точка входа, регистрация команд и представлений
    ├── localization/
    │   └── texts.ts          # Все текстовые строки (русская локализация)
    ├── api/
    │   ├── client.ts         # HTTP-клиент (PAT auth, check-hashes, upload, download)
    │   └── types.ts          # TypeScript-интерфейсы
    ├── commands/
    │   ├── setToken.ts       # Команды токена и URL сервера
    │   └── convertQuick.ts   # scan → hash → check → upload → SSE → download
    ├── services/
    │   ├── hasher.ts         # Обход файловой системы, SHA-256, фильтрация
    │   └── sseClient.ts      # SSE-клиент статусов задач
    ├── snippets/
    │   └── gost-markdown.json
    └── ui/
        ├── sidebarView.ts    # Боковая панель с кнопками и предупреждениями
        ├── statusBar.ts      # Status bar item
        └── historyView.ts    # История последних конвертаций
```

## Разработка

```bash
# Установка зависимостей
npm install

# Компиляция в watch-режиме
npm run watch

# Запуск extension host
# (откройте папку vscode-extension в VS Code и нажмите F5)

# Проверка типов без генерации файлов
npx tsc --noEmit

# Сборка релизного .vsix
npm run vscode:prepublish
npx @vscode/vsce package --no-dependencies
```
