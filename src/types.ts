import type { TFile } from 'obsidian';

/**
 * Идентификатор типа контента: встроенный (book, movie, series, anime, game)
 * или пользовательский из настроек.
 */
export type ContentTypeId = string;

export type ContentStatus = 'planned' | 'in-progress' | 'finished' | 'abandoned';

/**
 * Id любого статуса: встроенный или пользовательский. Пересечение с
 * `string & {}` сохраняет автодополнение встроенных id.
 */
export type ContentStatusId = ContentStatus | (string & {});

export type FieldKind = 'text' | 'number';

export interface FieldDef {
	/** Ключ в frontmatter карточки. */
	key: string;
	/** Подпись поля в интерфейсе. */
	label: string;
	kind: FieldKind;
	placeholder?: string;
}

export interface TypeSchema {
	id: ContentTypeId;
	label: string;
	/** Имя иконки Lucide. */
	icon: string;
	/** Подпапка типа внутри корневой папки. */
	folder: string;
	/** Ключ поля, выводимого под названием на дашборде. */
	subtitleField: string | null;
	/** Дополнительные поля карточки ( помимо общих ). */
	fields: FieldDef[];
	/** Ключ frontmatter с текущим прогрессом либо null, если тип без прогресса. */
	progressField: string | null;
	progressTotalField: string | null;
	progressUnit: string;
	/** Быстрые шаги для кнопок «прибавить». */
	progressQuickSteps: number[];
}

export interface ProgressValue {
	current: number | null;
	total: number | null;
}

/** Времена прохождения из HowLongToBeat в часах; null — нет данных. */
export interface HltbTimes {
	id: number | null;
	main: number | null;
	extra: number | null;
	complete: number | null;
}

export interface ContentItem {
	file: TFile;
	type: ContentTypeId;
	title: string;
	status: ContentStatusId;
	fields: Record<string, string | number>;
	progress: ProgressValue;
	/** Оценка 1–5 или null, если не оценено. */
	rating: number | null;
	/** Путь обложки из frontmatter ( cover ) или null. */
	cover: string | null;
	/** Ссылка или текст «где взять» из frontmatter ( source ) или null. */
	source: string | null;
	/** Краткое описание из frontmatter ( description ) или null. */
	description: string | null;
	/** Данные HowLongToBeat ( hltb-* ) или null, если их нет. */
	hltb: HltbTimes | null;
	started: string | null;
	finished: string | null;
}

/** Цвет пилюли статуса: имя CSS-переменной Obsidian --color-*. */
export type StatusColor =
	| 'blue'
	| 'green'
	| 'orange'
	| 'red'
	| 'yellow'
	| 'purple'
	| 'cyan'
	| 'pink';

export const STATUS_COLORS: readonly StatusColor[] = [
	'blue',
	'green',
	'orange',
	'red',
	'yellow',
	'purple',
	'cyan',
	'pink',
];

export interface StatusDef {
	id: string;
	label: string;
	/** Цвет пилюли; null — нейтральный серый. */
	color: StatusColor | null;
}

export const BUILTIN_TYPES: TypeSchema[] = [
	{
		id: 'book',
		label: 'Книга',
		icon: 'book',
		folder: 'Books',
		subtitleField: 'author',
		fields: [
			{
				key: 'author',
				label: 'Автор',
				kind: 'text',
				placeholder: 'Фрэнк Герберт',
			},
			{
				key: 'pages-total',
				label: 'Всего страниц',
				kind: 'number',
				placeholder: '412',
			},
		],
		progressField: 'pages-read',
		progressTotalField: 'pages-total',
		progressUnit: 'стр.',
		progressQuickSteps: [10, 50],
	},
	{
		id: 'movie',
		label: 'Фильм',
		icon: 'clapperboard',
		folder: 'Movies',
		subtitleField: 'director',
		fields: [
			{
				key: 'director',
				label: 'Режиссёр',
				kind: 'text',
				placeholder: 'Кристофер Нолан',
			},
			{
				key: 'year',
				label: 'Год',
				kind: 'number',
				placeholder: '2014',
			},
			{
				key: 'runtime',
				label: 'Хронометраж, мин.',
				kind: 'number',
				placeholder: '169',
			},
			{ key: 'genres', label: 'Жанры', kind: 'text' },
			{ key: 'original-title', label: 'Оригинальное название', kind: 'text' },
			{ key: 'metadata-rating', label: 'Рейтинг источника', kind: 'number' },
			{ key: 'metadata-id', label: 'ID источника', kind: 'text' },
		],
		progressField: null,
		progressTotalField: null,
		progressUnit: '',
		progressQuickSteps: [],
	},
	{
		id: 'series',
		label: 'Сериал',
		icon: 'tv',
		folder: 'Series',
		subtitleField: 'creator',
		fields: [
			{ key: 'creator', label: 'Создатель', kind: 'text' },
			{ key: 'year', label: 'Год', kind: 'number', placeholder: '2024' },
			{ key: 'seasons-total', label: 'Сезонов', kind: 'number' },
			{ key: 'episodes-total', label: 'Эпизодов', kind: 'number' },
			{ key: 'genres', label: 'Жанры', kind: 'text' },
			{ key: 'original-title', label: 'Оригинальное название', kind: 'text' },
			{ key: 'metadata-rating', label: 'Рейтинг источника', kind: 'number' },
			{ key: 'metadata-id', label: 'ID источника', kind: 'text' },
		],
		progressField: 'episodes-watched',
		progressTotalField: 'episodes-total',
		progressUnit: 'эп.',
		progressQuickSteps: [1, 5],
	},
	{
		id: 'anime',
		label: 'Аниме',
		icon: 'sparkles',
		folder: 'Anime',
		subtitleField: 'studio',
		fields: [
			{ key: 'studio', label: 'Студия', kind: 'text' },
			{ key: 'director', label: 'Режиссёр', kind: 'text' },
			{ key: 'creator', label: 'Создатель', kind: 'text' },
			{ key: 'year', label: 'Год', kind: 'number', placeholder: '2024' },
			{ key: 'seasons-total', label: 'Сезонов', kind: 'number' },
			{ key: 'episodes-total', label: 'Эпизодов', kind: 'number' },
			{ key: 'runtime', label: 'Хронометраж, мин.', kind: 'number' },
			{ key: 'genres', label: 'Жанры', kind: 'text' },
			{ key: 'original-title', label: 'Оригинальное название', kind: 'text' },
			{ key: 'metadata-rating', label: 'Рейтинг источника', kind: 'number' },
			{ key: 'metadata-id', label: 'ID источника', kind: 'text' },
		],
		progressField: 'episodes-watched',
		progressTotalField: 'episodes-total',
		progressUnit: 'эп.',
		progressQuickSteps: [1, 5],
	},
	{
		id: 'game',
		label: 'Игра',
		icon: 'gamepad-2',
		folder: 'Games',
		subtitleField: 'platform',
		fields: [
			{
				key: 'platform',
				label: 'Платформа',
				kind: 'text',
				placeholder: 'PC',
			},
		],
		progressField: 'hours-played',
		progressTotalField: null,
		progressUnit: 'ч',
		progressQuickSteps: [1],
	},
];

export const STATUSES: StatusDef[] = [
	{ id: 'planned', label: 'Запланировано', color: null },
	{ id: 'in-progress', label: 'В работе', color: 'blue' },
	{ id: 'finished', label: 'Завершено', color: 'green' },
	{ id: 'abandoned', label: 'Брошено', color: 'orange' },
];

/**
 * Любая непустая строка проходит как есть — включая id пользовательских
 * статусов и значения, удалённые из настроек. Иначе 'planned'.
 */
export function parseStatusId(value: unknown): ContentStatusId {
	return typeof value === 'string' && value.trim() !== '' ? value : 'planned';
}

/** Подпись статуса из списка типа; для неизвестного id — сам id. */
export function labelForStatus(statuses: StatusDef[], id: string): string {
	return statuses.find((s) => s.id === id)?.label ?? id;
}
