# EduBase4Teachers

Учебный шаблон методического онлайн-ресурса для учителей. Фронтенд на React (Vite) + TailwindCSS v4 (CSS‑first), роутинг через React Router. В составе есть минимальный бэкенд авторизации (Express + SQLite + JWT) для учебных целей.

## Скрипты
- `npm run dev` — запуск dev-сервера
- `npm run build` — сборка
- `npm run preview` — предпросмотр сборки
- `npm run lint` — линтинг
- `npm run format` — форматирование

## Переменные окружения (frontend)
Создайте файл `.env` при необходимости:
```
VITE_API_BASE_URL=http://localhost:4000/api
```

## Структура
- Шапка с навигацией и футер
- Страницы: Главная, Материалы (+ фильтры), Конспекты, Презентации, Рабочие программы, Форум, Лучшие практики, Личный кабинет (Мои материалы, Мои сохранённые), Новости, О проекте

## Разработка (frontend)
1. Установите Node.js LTS
2. Установите зависимости: `npm install`
3. Запустите dev-сервер: `npm run dev`

Tailwind v4: конфиг в стиле v3 не используется. Источники и тема задаются в `src/index.css` через директивы `@source` и `@theme`. Файлы `tailwind.config.js` и `postcss.config.js` либо удалены, либо сведены к no-op, чтобы Vite не пытался грузить `autoprefixer`.

## Развертывание

### Локально (Windows PowerShell)
- Требуется: Node.js LTS, npm
- Фронтенд:
  1. В корне: `npm install`
  2. Создайте `.env` (опционально):
	  ```
	  VITE_API_BASE_URL=http://localhost:4000/api
	  ```
  3. Запуск dev: `npm run dev` → http://localhost:5173/
- Бэкенд:
  1. Перейдите в `server/`: `cd server`
  2. Установка: `npm install`
  3. Запуск dev: `npm run dev` → http://localhost:4000/

Подсказка: в VS Code уже настроены задачи `vite: dev` и `server: dev`, можно запускать их параллельно.

### Продакшен (однохостовый, без Docker)
1. Соберите фронтенд:
	- В корне: `npm ci; npm run build` (сгенерирует `dist/`)
2. Поднимите API (Node 18+):
	- В `server/`: `npm ci`
	- Запуск: `node index.js` (или `npm run start`, если добавите скрипт)
3. Отдача фронтенда:
	- Любым статическим сервером (Nginx/Apache) укажите корень на `dist/`.
	- Проксируйте `/api` на `http://localhost:4000`.
4. Настройте окружение:
	- Фронтенд: `VITE_API_BASE_URL=https://YOUR_HOST/api`
	- Бэкенд: опционально `PORT=4000`, `JWT_SECRET=your-strong-secret`

Пример Nginx location:
```
location /api/ {
  proxy_pass http://127.0.0.1:4000/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
location / {
  root /var/www/edubase4teachers/dist;
  try_files $uri /index.html;
}
```

### База и загрузки
- SQLite база хранится в `server/auth.db` (игнорируется в Git).
- Загруженные файлы — в `server/uploads` (также игнорируются в Git).
- Для чистой установки продакшена достаточно запустить сервер — таблицы создаются автоматически.

## Бэкенд авторизации (server/)
В репозитории включён минимальный сервер Express с SQLite в папке `server/`:

- Установка: из папки `server/` выполните `npm install`
- Запуск (dev): `npm run dev` (по умолчанию порт 4000)
- Проверка: GET http://localhost:4000/api/health → `{ ok: true }`

Эндпоинты авторизации:
- POST `/api/auth/register` — { name, email, password }
- POST `/api/auth/login` — { email, password }
- GET `/api/auth/me` — с заголовком Authorization: Bearer <token>

Клиент Axios настроен в `src/api/axios.ts` (базовый URL берётся из `VITE_API_BASE_URL`).

### Материалы и файлы
- При создании материала первый загруженный файл сохраняется как «основной» (legacy-поле таблицы `materials`). Все дополнительные файлы можно добавлять как:
	- дополнительные основные файлы (флаг `is_main = 1` в `material_files`),
	- дополнительные вложения (без `is_main`).
- В результате у материала может быть несколько «основных» файлов одновременно. На публичной странице «Материалы» и в «Мои материалы» основные файлы показываются отдельно от дополнительных.
- Удаление файлов удаляет и запись в БД, и физический файл на диске.

### Новости (Inform.kz)
- Бэкенд имеет эндпоинт `GET /api/news/inform`, который парсит раздел «Образование» сайта Inform.kz.
- Реализовано кеширование в памяти на 5 минут, чтобы не перегружать источник.
- На фронтенде есть страница «Новости», которая отображает ленту карточек.

### Запуск обоих серверов
- В корне проекта: `npm run dev` — запустит Vite на http://localhost:5173
- В папке `server/`: `npm run dev` — запустит API на http://localhost:4000 (в VS Code есть готовые задачи `vite: dev` и `server: dev`)

### Трюки и устранение неполадок
- Если при старте сервера увидите ошибку про `cheerio` вида «does not provide an export named 'default'», используйте именованный импорт в `server/index.js`:
	`import { load as cheerioLoad } from 'cheerio'` и далее `const $ = cheerioLoad(html)`.
 - При миграции на Tailwind v4 уберите зависимости и конфиг PostCSS с `autoprefixer`. Vite использует Lightning CSS для префиксов автоматически.

### Иконка и манифест
- Фавикон добавлен в `public/favicon.svg` и подключён в `index.html`.
- PWA‑манифест `public/site.webmanifest` подключён через `<link rel="manifest" ...>`.
