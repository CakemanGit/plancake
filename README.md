# PlanCake — Discord task planner

PlanCake — персональный планировщик задач для Discord на TypeScript, `discord.js`, Luxon и SQLite. Готовое описание бота для Developer Portal находится в [`BOT_PROFILE.md`](BOT_PROFILE.md).

## Возможности

- Нативные slash-команды `/help` и `/info`.
- `/task add|list|complete|delete`: задачи, повторения, отметка выполнения и удаление.
- `/plan today|tomorrow|date|week|weekdays|weekend|holiday|vacation`: планы по датам и типам дней.
- `/calendar holiday-add|holiday-list|holiday-remove`: персональный список праздничных дат.
- `/calendar vacation-add|vacation-list|vacation-remove`: периоды каникул/отпуска.
- `/settings timezone`: индивидуальный часовой пояс IANA (по умолчанию `Europe/Kyiv`).
- `/settings reminders`: включение или выключение личных напоминаний.
- `/dm-plan`: отправка выбранного периода в личные сообщения Discord.
- Автоматические напоминания в ЛС, если у задачи задано время `HH:MM`.
- SQLite сохраняет задачи и настройки при перезапуске.
- Персональные данные задач изолированы по Discord user ID; команды в сервере отвечают приватно.
- Плановые embed-ответы используют категории в inline-code, Markdown и встроенные Discord timestamp-теги вида `<t:UNIX:t>` и `<t:UNIX:R>`.

Праздничные даты и каникулы задаются вручную в версии 1.0.0: бот не предполагает страну пользователя и не подменяет личный календарь неизвестным набором государственных праздников.

## Требования

- Node.js `24.17.0` или новее.
- npm.
- Discord application и bot token в Discord Developer Portal.

## 1. Создать Discord-приложение

1. Открой https://discord.com/developers/applications и нажми **New Application**.
2. Назови приложение `PlanCake`.
3. В **General Information** скопируй **Application ID** — это будет `CLIENT_ID`.
4. Открой вкладку **Bot**, создай бота, затем скопируй токен. Храни токен только в локальном `.env` или в секретах хостинга. Не отправляй его никому и не добавляй в Git.
5. Через **OAuth2 → URL Generator** выбери scopes `bot` и `applications.commands`. Для обычной установки достаточно permissions `Send Messages` и `Embed Links`. Сгенерируй ссылку и добавь бота на свой сервер.
6. Привилегированные Gateway Intents включать не нужно: бот использует только `Guilds` и не читает историю сообщений.

## 2. Запустить локально в Windows / VS Code

1. Установи Node.js `24.17.0` или новее с https://nodejs.org/en/download и перезапусти терминал.
2. Распакуй архив, открой папку `plancake-bot` в VS Code и выбери **Terminal → New Terminal**.
3. Убедись, что команды `node -v` и `npm -v` работают.
4. Скопируй шаблон окружения (PowerShell):

```powershell
Copy-Item .env.example .env
```

5. Открой `.env` в VS Code и заполни `CLIENT_ID`, `DISCORD_TOKEN` и `GUILD_ID`. Не вставляй токен в исходники.
6. Установи зависимости и зарегистрируй команды:

```powershell
npm install
npm run deploy:commands
```

7. Запусти бота:

```powershell
npm run dev
```

Пока этот терминал работает, локальный процесс бота подключён к Discord. Закрытие терминала остановит локальный процесс; чтобы бот был онлайн постоянно, используй VPS-инструкцию ниже.

## 3. Быстрый сценарий проверки

1. Выполни `/help` и `/info`.
2. Выполни `/task add` и заполни `title`, `pattern=daily`, `time=18:30`.
3. Выполни `/plan today` и `/task list`.
4. Выполни `/task complete` с ID задачи. Для повторяющейся задачи выполненной станет только сегодняшняя дата.
5. Добавь праздник через `/calendar holiday-add`, затем создай задачу с `pattern=holiday` и открой `/plan holiday`.
6. Добавь каникулы через `/calendar vacation-add`, затем задачу `pattern=vacation` и открой `/plan vacation`.
7. Выполни `/dm-plan period=week`, чтобы отправить недельный план себе в ЛС.
8. Укажи время задачи в ближайшие несколько минут и убедись, что бот присылает напоминание. Если личные сообщения от участников сервера закрыты, Discord может отклонить отправку.

## Часовые пояса и время

Время задачи интерпретируется в текущем персональном часовом поясе пользователя. По умолчанию — `Europe/Kyiv`. Измени его командой `/settings timezone timezone:Europe/Warsaw` или другим валидным именем IANA. После смены часового пояса напоминания и календарные даты вычисляются в новом поясе.

Напоминания проверяются примерно каждые 30 секунд и отправляются с допуском до 5 минут после заданного времени. Чтобы бот не повторял ошибку каждую минуту, попытка отправки отмечается как обработанная даже при закрытых ЛС. Если процесс был выключен надолго, старое уведомление не будет присылаться спустя часы.

## 4. Бесплатный хостинг 24/7: Google Cloud Free Tier

Для этой версии я рекомендую небольшой постоянный Linux VPS, а не платформу, которая усыпляет процессы. У Google Cloud есть Free Tier для одного non-preemptible `e2-micro` Compute Engine VM в месяц в регионах `us-west1`, `us-central1` или `us-east1`, до 30 GB-month стандартного persistent disk и 1 GB исходящего трафика из Северной Америки за месяц. Это именно ограниченный бесплатный уровень: условия и право на участие могут меняться, регистрация может потребовать платёжный профиль, а превышение лимитов или создание платных ресурсов может привести к расходам. Источник: https://docs.cloud.google.com/free/docs/free-cloud-features

Рекомендуемые настройки:

1. Создай проект в Google Cloud Console и активируй Compute Engine API.
2. Создай VM с Linux, типом `e2-micro` в одном из поддерживаемых регионов.
3. Оставь стандартный persistent disk в пределах бесплатного лимита. Для Discord-бота входящие сетевые порты обычно открывать не нужно: бот устанавливает исходящее Gateway-соединение с Discord.
4. Установи Node.js `24.17.0` или новее и npm.
5. Загрузи проект, создай `.env`, зарегистрируй команды и собери TypeScript по шагам ниже.
6. Запусти сервис через `systemd`, чтобы он автоматически запускался после перезагрузки и перезапускался при аварийном завершении.
7. Настрой бюджетное уведомление в Google Cloud Billing и регулярно проверяй использование. Бюджетное уведомление предупреждает о расходах, но само по себе не блокирует платные ресурсы.

У бесплатного уровня есть ограничения по региону и исходящему трафику, но он подходит для небольшого бота и других лёгких Node.js-бэкендов, пока все ресурсы остаются в пределах разрешённой квоты. Для более крупного приложения может потребоваться платный тариф.

**Альтернатива:** Oracle Cloud Always Free предлагает бесплатные VM с другими лимитами, но в документации Oracle отдельно указано, что простаивающие Always Free compute instances могут быть отозваны при низкой загрузке в течение семи дней. Для тихого Discord-бота это существенный риск, поэтому не считаю его безусловно надёжным вариантом 24/7. Источник: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

### Подготовка и запуск на VPS

Пример для Ubuntu/Debian с Node.js 24 и npm:

1. Загрузи папку проекта на сервер (например, через Git или SCP).
2. В каталоге проекта выполни `npm ci` (если на сервер загружен `package-lock.json`) или `npm install`.
3. Создай `.env`, выполни `npm run deploy:commands`, затем `npm run build`.
4. Создай отдельного пользователя ОС для бота и убедись, что у него есть право записи в каталог `data/`.
5. Создай `/etc/systemd/system/plancake.service`, заменив `/opt/plancake-bot` на свой реальный путь:

```ini
[Unit]
Description=PlanCake Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=plancake
WorkingDirectory=/opt/plancake-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/plancake-bot/dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Проверь точный путь к Node.js командой `which node`; если он отличается от `/usr/bin/node`, исправь `ExecStart`.

Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plancake
sudo systemctl status plancake
sudo journalctl -u plancake -f
```

**Важно:** папка базы данных должна находиться на постоянном диске, а не в эфемерном каталоге, который очищается между перезапусками или деплоями. Делай резервные копии `data/plancake.sqlite` и не публикуй `.env`.

## 5. Команды

| Команда | Назначение |
|---|---|
| `/help`, `/info` | Справка и информация |
| `/task add` | Создать одноразовую, ежедневную, будничную, выходную, праздничную задачу или задачу на каникулы |
| `/task list` | Показать задачи и ID |
| `/task complete` | Отметить задачу выполненной для даты |
| `/task delete` | Удалить задачу |
| `/plan today`, `/plan tomorrow`, `/plan date` | План на дату |
| `/plan week`, `/plan weekdays`, `/plan weekend` | План на период |
| `/plan holiday`, `/plan vacation` | План по личному календарю |
| `/calendar holiday-add`, `/calendar holiday-list`, `/calendar holiday-remove` | Праздники |
| `/calendar vacation-add`, `/calendar vacation-list`, `/calendar vacation-remove` | Каникулы/отпуск |
| `/settings timezone` | Часовой пояс пользователя |
| `/settings reminders` | Личные напоминания вкл./выкл. |
| `/dm-plan` | Отправить свой план в ЛС |

## Известные ограничения версии 1.0.0

- Национальные праздники не импортируются автоматически; их нужно добавить в личный календарь.
- Напоминание требует установленного времени и возможности отправлять тебе личные сообщения.
- Один процесс бота рассчитан на один экземпляр сервиса. Не запускай два экземпляра с одной и той же базой: для небольшого бота достаточно одного процесса.
- Это готовая стартовая версия, а не гарантия безотказной работы: проверяй логи, делай резервные копии и не размещай токен в публичном репозитории.
