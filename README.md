# EduBase4Teachers

Учебный шаблон методического онлайн‑ресурса: фронтенд на React (Vite + TS + Tailwind v4), бэкенд на Express + SQLite + JWT. Готов к локальному запуску «из коробки» и развёртыванию на одном хосте.

## 🚀 Быстрый старт (Windows PowerShell)

1) Установите Node.js LTS (включая npm).

2) В корне проекта выполните:

```powershell
npm install
npm run dev:all
```

Это автоматически:
- установит зависимости фронтенда и бэкенда (postinstall установит deps в `server/`),
- создаст `.env` и `server/.env` из примеров,
- поднимет оба dev‑сервера параллельно:
	- Frontend: http://localhost:5173
	- API: http://localhost:4000

Остановить: Ctrl+C в терминале.

Если хотите запускать по отдельности:
- только фронтенд: `npm run dev:client`
- только бэкенд: `npm run dev:server`

В VS Code уже есть задачи «vite: dev» и «server: dev», а также объединённая «dev: all» (Run and Debug → Tasks).

## ⚙️ Переменные окружения

В корне есть `.env.example`, а в `server/` — `.env.example`. Скрипт `npm run setup` создаёт `.env`‑файлы, если их ещё нет.

- Frontend (`.env`):
	- `VITE_API_BASE_URL` — базовый URL API. По умолчанию используется `/api` через Vite‑proxy, поэтому в dev переменную можно не указывать.

Примечание: Vite проксирует пути `/api` и `/uploads` на бэкенд (`http://localhost:4000`). Это позволяет использовать один публичный URL (туннель к 5173) без CORS.

- Backend (`server/.env`):
	- `PORT` — порт API (по умолчанию 4000)
	- `JWT_SECRET` — секрет для подписи JWT (обязательно поменяйте в продакшене)

## 🧩 Скрипты

- `npm run dev:all` — запустить фронтенд и бэкенд параллельно
- `npm run dev:client` — только Vite dev
- `npm run dev:server` — только API (nodemon)
- `npm run build` — сборка фронтенда в `dist/`
- `npm run preview` — предпросмотр сборки
- `npm run typecheck` — проверка типов
- `npm run lint` — линтинг (ESLint 9 flat)
- `npm run format` — форматирование (Prettier)
- `npm run setup` — создать `.env`/`server/.env`, гарантировать `server/uploads/`

## 📁 Что внутри

- Навигация (Header), футер, адаптивное меню, 404‑страница
- Страницы: Главная, Материалы (поиск FTS5 с релевантностью, фильтры/сортировки, пагинация, избранное для авторизованных), Конспекты, Презентации, Рабочие программы, Форум, Опыт учителей, Личный кабинет (Мои материалы, Мои сохранённые, Настройки), Новости, О проекте
- Tailwind v4 (CSS‑first): директives `@source` и `@theme` в `src/index.css`; общие кнопки `.btn`, `.btn-primary`, `.btn-outline`
- Бэкенд: авторизация (регистрация/логин/JWT), CRUD материалов с загрузкой нескольких «основных» и доп. файлов, скачивание с оригинальными именами, серверные «избранные», счётчики просмотров/скачиваний, базовая статистика `/api/stats`, парсер новостей Inform.kz с кешем и фильтрацией рекламы
- Превью файлов: изображения и PDF в модальном окне
- Локализация: русский (RU)
- SQLite база `server/auth.db` (создаётся автоматически); загрузки в `server/uploads/`

## 🛠️ Разработка

1. `npm install` — установит deps и в `server/` (благодаря postinstall)
2. `npm run dev:all` — фронт и API поднимутся сразу
3. Проверка API: GET /api/health (через прокси) или напрямую http://localhost:4000/api/health → `{ ok: true }`

### Туннели / публичный доступ
- Для временного общего доступа поднимите туннель до `http://localhost:5173` (например, ngrok). Так как фронтенд проксирует `/api` и `/uploads`, приложение будет работать по одному URL.

### Tailwind v4 заметки
- Конфиг v3 не используется; тема объявляется в CSS. PostCSS‑конфиг минимален — префиксы делает Lightning CSS из Vite.
- При ошибках вида invalidConfigPath убедитесь, что в `src/index.css` определены шрифтовые токены и тема.

## 🚢 Продакшен (без Docker)

1) Сборка фронтенда:

```powershell
npm ci
npm run build
```

2) API (Node 18+):

```powershell
cd server
npm ci
npm start
```

3) Отдача фронтенда любым статическим сервером, например Nginx:

```
location /api/ {
	proxy_pass http://127.0.0.1:4000/api/;
	proxy_set_header Host $host;
	proxy_set_header X-Real-IP $remote_addr;
}
location /uploads/ {
	proxy_pass http://127.0.0.1:4000/uploads/;
}
location / {
	root /var/www/edubase4teachers/dist;
	try_files $uri /index.html;
}
```

Окружение:
- Frontend: `VITE_API_BASE_URL=/api` (или полный URL, если фронт и бэк на разных доменах)
- Backend: `PORT=4000`, `JWT_SECRET=your-strong-secret`

## 💾 База и файлы

- SQLite хранится в `server/auth.db` (игнорируется Git)
- Загрузки — в `server/uploads/` (игнорируются Git)
- Сервер сам создаёт таблицы и папку загрузок при старте

## 🧪 Полезные эндпоинты

- `GET /api/health` — проверка API
- `POST /api/auth/register` — { name, email, password }
- `POST /api/auth/login` — { email, password }
- `GET /api/auth/me` — Authorization: Bearer <token>
- `GET /api/news/inform` — последние новости образования с Inform.kz
 - `GET /api/materials` — список материалов (q, subject, grade, type, sort=new|popular|relevance, limit, offset)
 - `GET /api/materials/favorites` — избранные пользователя (требуется авторизация)
 - `POST/DELETE /api/materials/:id/favorite` — добавить/убрать из избранных
 - `POST /api/materials/:id/view` — инкремент просмотров
 - `GET /api/files/:id/download` — скачивание вложения (инкремент скачиваний)
 - `GET /api/stats` — базовая статистика (топ предметы/классы, популярные, новые)

## ❗Трюки и устранение неполадок

- Cheerio: используйте именованный импорт: `import { load as cheerioLoad } from 'cheerio'`
- Tailwind v4: убедитесь, что не тянете старый `autoprefixer` вручную; Vite сам префиксует
- Windows PowerShell: объединяйте команды через `;` при необходимости

## 🔖 Лицензия

Для учебных целей. Используйте и модифицируйте свободно.
