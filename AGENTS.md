# AGENTS.md

## Назначение

Этот репозиторий — Telegram-бот "Нейро Анатолий". Бот консультирует пользователей по вопросам здоровья, рекомендует и консультирует по товарам каталога "Сибирского Здоровья", отслеживает прогресс в динамике. Бот работает на **Cloudflare Workers** и библиотеке **grammy**. Бот:

- Отвечает на сообщения пользователей.
- Хранит историю диалога в **Cloudflare D1**.
- Ведёт «записную книжку» (summary) пользователя между сессиями.
- Рекомендует товары из каталога "Сибирского Здоровья" через **AI Search / AutoRAG**.

Цель этого файла — дать агентам/ассистентам и новым контрибьюторам минимальный, но точный ориентир:

- Где точки входа и ключевая логика.
- Как запускать локально/тестировать/деплоить.
- Какие инварианты проекта нельзя ломать.

## Быстрый старт

- Локальная разработка (dev-бот автоматически начинает работать за счет локально запущенного сервиса cloudflared):

```bash
npm run dev
```

- Деплой в Cloudflare:

```bash
npm run deploy
```

## Ключевые точки входа

- **Worker entrypoint**: `src/index.ts`
  - Создаёт `Bot`.
  - Инициализирует сервисы:
    - `SessionService` (D1)
    - `NotebookService` (D1 + AI)
  - Обрабатывает:
    - `/start`
    - `message` (основной чат-флоу)
  - Обрабатывает ответы модели:
    - экранирование MarkdownV2
    - подстановка реферальных ссылок по `src/data/product-links.json`
  - Экспортирует `fetch` и отдаёт обработчик `webhookCallback(bot, 'cloudflare-mod', ...)`.

## Конфигурация и биндинги (Cloudflare)

- Конфиг Wrangler: `wrangler.jsonc`
- Основные биндинги окружения:
  - `TELEGRAM_BOT_TOKEN` (строка)
  - `DB` (D1Database)
  - `AI` (Ai)

Типы окружения описаны в `worker-configuration.d.ts` (автогенерация wrangler).

### Локальные переменные

- Файл `.dev.vars` используется скриптами/локальной разработкой.

## Основная архитектура (data flow)

1) **Telegram webhook** вызывает `fetch` воркера (`src/index.ts`).
2) На вход `message`:
   - Проверяется наличие текста и `userId`.
   - `SessionService.getOrCreateSession(userId)`:
     - поддерживает активные сессии
     - таймаут сессии ~15 минут
     - лимит сообщений ~20 (overflow)
   - Если сессия переполнена или истекла — триггерится обновление записной книжки.
3) `NotebookService`:
   - хранит агрегированный summary в таблице `notebooks`
   - обновляет его через `env.AI.run(...)` в фоне (через `ctx.waitUntil`).
4) Для ответа:
   - строится системный промпт: `buildSystemPrompt(notebook)` (`src/config/systemPrompt.ts`).
   - вызывается чат: `runChat(env.AI, systemPrompt, history, message)` (`src/services/chat.ts`).
5) В `runChat`:
   - модель запускается через `runWithTools`.
   - определён tool `search_products`, который ходит в `ai.autorag('syberian-wellness-products').search(...)`.
6) Ответ:
   - сохраняется в D1 как сообщения (user/assistant).
   - экранируется под Telegram `MarkdownV2`.
   - ссылки `[Название](ID)` превращаются в реферальные URL через `src/data/product-links.json`.

## База данных (D1) и Drizzle

- Схема: `src/db/schema.ts`
- Миграции: `src/db/migrations/*`
  - текущие таблицы:
    - `sessions`, `messages`, `notebooks`

Сервисы доступа:

- `src/services/session.ts` — управление сессиями и историей сообщений.
- `src/services/notebook.ts` — summary (notebook) пользователя.

### Локальная SQLite для RAG-скриптов

Для скриптов в `scripts/rag/*` используется локальная SQLite база `rag/database.db` (см. `drizzle.config.ts`).

## Скрипты репозитория

См. `package.json`.

### Telegram webhook

- `npm run tgbot:setWebhookUrl:local`
  - `scripts/tgbot/setWebhookUrl/local.ts`
  - читает `.dev.vars`

- `npm run tgbot:setWebhookUrl:production`
  - `scripts/tgbot/setWebhookUrl/production.ts`
  - читает `wrangler.jsonc`

### D1 утилиты

- `npm run db:clear`
  - `scripts/db/clear-d1.ts`
  - удаляет данные из всех таблиц D1
  - по умолчанию требует подтверждения (или `--force`)
  - поддерживает `--local` / `--remote`

### RAG пайплайн (каталог товаров)

- `npm run rag:prepare-db`
  - `scripts/rag/prepare-db.mts`
  - пересоздаёт `rag/database.db` и применяет схему через `drizzle-kit push`

- `npm run rag:scrape`
  - `scripts/rag/scrape.mts`
  - скрейпит категории/товары и кладёт в локальную БД

- `npm run rag:generate`
  - `scripts/rag/generate.mts`
  - генерирует HTML на каждый товар в `rag/r2-products/` (имя файла: `[{id}] {name}.html`)

- `npm run rag:sync-r2`
  - `scripts/rag/sync-r2.mts`
  - синхронизирует `rag/r2-products/` в R2 bucket (для AutoRAG)

- `npm run rag:refresh-product-links`
  - `scripts/rag/refresh-product-links.mts`
  - обновляет `src/data/product-links.json` из локальной БД товаров

## Инварианты и правила изменений

### Про Worker-код vs Node-скрипты

- Всё, что исполняется в воркере (`src/*`), должно быть совместимо с Cloudflare Workers runtime.
- Node.js API (fs/path/child_process и т.п.) допустимы **только** в `scripts/*`.

### Формат ссылок на товары

- Модель должна использовать ссылки строго как `[Название](ID_товара)`.
- Воркер позже преобразует их в реальные URL (через `src/data/product-links.json`).

### Telegram Markdown

- По умолчанию ответы уходят с `parse_mode: 'MarkdownV2'`.
- Любые изменения формата ответа должны учитывать экранирование спецсимволов.

### Производительность и фоновые задачи

- Тяжёлые операции (например, обновление notebook) должны выполняться через `ctx.waitUntil(...)`.
- Не блокируй основной хендлер долгими запросами, если можно вынести в фон.

## Тестирование

- `vitest` настроен через `@cloudflare/vitest-pool-workers` и использует `wrangler.jsonc`.
- Перед изменениями/после изменений запускай:

```bash
npm test
```

## Деплой

- Деплой выполняется Wrangler-скриптом:

```bash
npm run deploy
```

После деплоя, если нужно, обнови webhook у бота (production):

```bash
npm run tgbot:setWebhookUrl:production
```

## Где смотреть требования к поведению бота

- Продуктовая/поведенческая спецификация: `spec.md`
- Системный промпт: `src/config/systemPrompt.ts`
