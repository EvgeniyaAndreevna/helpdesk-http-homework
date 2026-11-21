# HelpDesk — работа с HTTP

[![Build and Deploy HelpDesk](https://github.com/USERNAME/REPOSITORY/actions/workflows/deploy.yml/badge.svg)](https://github.com/USERNAME/REPOSITORY/actions/workflows/deploy.yml)

**GitHub Pages:** https://USERNAME.github.io/REPOSITORY/

Учебное приложение по заданию Нетологии «7. Работа с HTTP» (обязательная часть HelpDesk). Фронтенд использует **Webpack, npm, Fetch API и JSON**, а данные заявок получает с сервера. Автотесты не требуются.

## Возможности

- Загрузка списка тикетов: `GET ?method=allTickets`.
- Просмотр подробного описания по клику: `GET ?method=ticketById&id=<id>` — отдельный запрос.
- Создание: `POST ?method=createTicket` с JSON и `Content-Type: application/json`.
- Редактирование: `POST ?method=updateById&id=<id>`.
- Изменение статуса: `POST ?method=updateById&id=<id>`.
- Подтверждение удаления: `GET ?method=deleteById&id=<id>`. Ответ 204 обрабатывается без чтения JSON.
- Обработка ошибок сервера, состояния загрузки, адаптивная вёрстка, модальные окна.

## Локальный запуск (Windows PowerShell)

Установите Node.js 20 или новее. Сначала в папке проекта выполните:

```powershell
npm install
```

**Первое окно PowerShell** — локальный API (пример, совместимый с заданием):

```powershell
npm run server
```

**Второе окно PowerShell** — фронтенд:

```powershell
npm start
```

Откройте http://localhost:8080/. API по умолчанию: http://localhost:7070/. Вместо демонстрационного сервера можно использовать **[оригинальный backend Нетологии](https://github.com/netology-code/ahj-homeworks/tree/AHJ-50/http/helpdesk/backend)** (у него тот же порт и формат запросов). Учебный backend из `backend/` написан для проверки без сторонних зависимостей и хранит тикеты в файле `backend/data/tickets.json`, который не коммитится в Git.

## Публикация в GitHub Pages

1. Создайте **публичный** репозиторий на GitHub и перенесите в него **содержимое** этого проекта, включая скрытую папку `.github`.
2. После `npm install` появится `package-lock.json`. **Рекомендуется добавить его в коммит**: тогда GitHub Actions использует воспроизводимую установку `npm ci` (без файла автоматически выполнится `npm install`).
3. В `README.md` замените все `USERNAME` и `REPOSITORY` на логин и имя репозитория (включая бейдж).
4. В GitHub откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. После `git push` в ветку `main` выполняется `.github/workflows/deploy.yml`: `npm ci` (или `npm install`, если lock-файл ещё не создан), `npm run build`, публикация папки `dist/`.
6. Ссылка будет иметь вид `https://USERNAME.github.io/REPOSITORY/`.

### Важно о backend

**GitHub Pages не запускает Node.js!** Для работающего проекта на Pages сервер нужно опубликовать на отдельном хостинге с **HTTPS и CORS** (например, Render, Railway или собственный VPS). В качестве сервера можно использовать оригинальный backend Нетологии либо совместимый пример из `backend/`.

Подключение к API можно настроить любым из способов:

- На GitHub в **Settings → Secrets and variables → Actions → Variables** создайте переменную `API_URL` с публичным HTTPS-адресом backend. При следующей сборке адрес попадёт во frontend.
- Или откройте готовый сайт и нажмите **«Настройки API»** в правом верхнем углу. Адрес хранится в localStorage браузера; **тикеты там не хранятся**.

Если на GitHub Pages не указан публичный backend, появится подсказка о необходимости подключения. Адрес `localhost:7070` подходит только для запуска на собственном компьютере.

На бесплатном серверном хостинге с временной файловой системой сохранённые в `backend/data/tickets.json` записи могут исчезнуть после перезапуска или новой публикации. Для надёжного долговременного хранения нужна база данных либо постоянный диск.

## Полезные команды

```powershell
npm install       # установить зависимости и создать package-lock.json
npm start         # Webpack dev server, http://localhost:8080
npm run build     # production сборка в dist/
npm run server    # демонстрационный API, http://localhost:7070
npm run check     # проверка синтаксиса JS (не автотесты)
```

## Структура

```text
.github/workflows/deploy.yml  # сборка и публикация Pages
backend/server.cjs            # локальный совместимый API
src/index.html                # HTML-шаблон Webpack
src/app.js                    # список, модальные окна и UI
src/api.js                    # Fetch-запросы к серверу
src/styles.css                # стили через Webpack
src/assets/logo.svg           # изображение через Webpack
webpack.config.cjs            # конфигурация сборки
package.json                  # зависимости и npm-скрипты
```

**Задание:** https://github.com/netology-code/ahj-homeworks/tree/AHJ-50/http/helpdesk/
