# Content Log

Личный учёт потребляемого контента ( книги, фильмы, сериалы, аниме и игры ) для Obsidian: карточки
с frontmatter, статусы, прогресс, оценки, обложки, источник и живой дашборд.

## Сетевые вызовы

Плагин работает полностью локально, кроме трёх явно запрошенных действий:

- **Обложка по ссылке** — картинка грузится по указанному URL только для показа.
- **Поиск игры на howlongtobeat.com** ( меню «⋯» на карточке игры или команда
  палитры ) — запрос уходит на howlongtobeat.com: название игры, полученные
  времена прохождения и id сохраняются в карточку, обложка ставится ссылкой на
  CDN сайта ( без скачивания в хранилище ). Никакой телеметрии и фоновых
  запросов нет.
- **Поиск фильма, сериала или аниме на TMDB** ( меню «⋯» на карточке или
  команда палитры ) — название отправляется на `api.themoviedb.org`, а постеры
  загружаются с `image.tmdb.org`. Выбранные метаданные сохраняются во
  frontmatter; существующие пользовательские обложка и описание не
  перезаписываются. Запросов при запуске плагина нет.

Ключ TMDB хранится встроенным `SecretStorage` Obsidian. В `data.json` плагина
сохраняется только выбранное пользователем имя секрета. Поддерживаются v3 API
key и API Read Access Token; требуется Obsidian 1.11.4 или новее.

This product uses the TMDB API but is not endorsed or certified by TMDB.
Источник данных: [The Movie Database](https://www.themoviedb.org).

Для фильмов, сериалов и аниме источник отдельно выбирается в **Настройки →
Content Log → Провайдеры** — разверните одноимённую панель. Сейчас
зарегистрирован адаптер TMDB; новые
каталоги добавляются через общий `MediaMetadataProvider` без изменений поисковой
модалки, команд и записи frontmatter.

Карточки можно редактировать, не открывая Markdown-файл: выберите меню «⋯» у
строки или плитки на дашборде, затем **Редактировать карточку…**. Там же доступны
прогресс, оценка, обложка, источник и загрузка метаданных.

## Статусы

У каждого типа контента есть четыре встроенных статуса — «Запланировано»,
«В работе», «Завершено», «Брошено». Они управляют датами `started`/`finished`
и автопереходами: достижение конца прогресса завершает карточку, первый шаг
прогресса переводит «Запланировано» в «В работе».

В **Настройки → Content Log → Статусы по типам контента** для каждого типа
( включая встроенные ) можно добавить собственные статусы: ключ для
frontmatter, название и цвет пилюли. Такой статус — только метка: он не
меняет даты и не участвует в автопереходах, за исключением общего правила
«прогресс дошёл до конца → Завершено». Статус карточки хранится в поле
`status` её frontmatter, поэтому удаление статуса из настроек не ломает
карточку — значение сохраняется и показывается как есть.

## Импорт данных книг

Для книжной карточки с локальным источником PDF, EPUB, FB2, MOBI или AZW3 в
меню **⋯** доступно действие **Извлечь данные из источника…**. Плагин локально
определяет формат, размер, SHA-256 и состояние файла, затем показывает найденные
метаданные и содержание рядом с текущими значениями карточки.

Пустые поля выбраны по умолчанию, а существующие значения не перезаписываются
без явного выбора. Встроенная растровая обложка при применении сохраняется рядом
с карточкой под новым именем; существующие файлы не заменяются. Для PDF первая
страница локально отрисовывается в JPEG и предлагается как обложка, а число
страниц означает физические страницы. Для EPUB, FB2 и MOBI плагин не создаёт
искусственную пагинацию. OCR и сетевые запросы при импорте не используются.

На мобильных устройствах импорт ограничен файлами до 50 МБ, а PDF-обложка —
примерно 1,5 млн пикселей и 1600 пикселями по большей стороне. На компьютере
действуют лимиты 100 МБ, 2,5 млн пикселей и 2000 пикселей соответственно.

---

# Obsidian Sample Plugin

This is a sample plugin for Obsidian (https://obsidian.md).

This project uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This sample plugin demonstrates some of the basic functionality the plugin API can do.

- Adds a ribbon icon, which shows a Notice when clicked.
- Adds a command "Open modal (simple)" which opens a Modal.
- Adds a plugin setting tab to the settings page.
- Registers a global click event and outputs a Notice on click.
- Registers a global interval which logs 'setInterval' to the console.

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `src/main.ts` to `main.js`.
- Make changes to `src/main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Релизы

Релизы создаёт GitHub Actions автоматически. Поднимите версию командой
`npm version patch` (или `minor` / `major`) — она обновит `manifest.json`,
`package.json` и `versions.json` — и запушьте коммит в `master`. Workflow
`.github/workflows/release.yml` проверит версию из `manifest.json`, соберёт
плагин, прогонит тесты, поставит тег с номером версии (без префикса `v`) и
опубликует релиз с `main.js`, `manifest.json` и `styles.css`. Если релиз для
этой версии уже существует, workflow завершится без действий, поэтому
повторные пуши в `master` ничего не ломают.

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v18 (`node --version`).
- `npm i` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint

- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.
- This project already has eslint preconfigured, you can invoke a check by running`npm run lint`
- Together with a custom eslint [plugin](https://github.com/obsidianmd/eslint-plugin) for Obsidan specific code guidelines.
- A GitHub action is preconfigured to automatically lint every commit on all branches.

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
	"fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
	"fundingUrl": {
		"Buy Me a Coffee": "https://buymeacoffee.com",
		"GitHub Sponsor": "https://github.com/sponsors",
		"Patreon": "https://www.patreon.com/"
	}
}
```

## API Documentation

See https://docs.obsidian.md
