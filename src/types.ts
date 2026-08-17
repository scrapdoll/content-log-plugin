import type { TFile } from 'obsidian';

/**
 * Идентификатор типа контента: встроенный ('book' | 'movie' | 'game')
 * или пользовательский из настроек.
 */
export type ContentTypeId = string;

export type ContentStatus = 'planned' | 'in-progress' | 'finished' | 'abandoned';

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

export interface ContentItem {
	file: TFile;
	type: ContentTypeId;
	title: string;
	status: ContentStatus;
	fields: Record<string, string | number>;
	progress: ProgressValue;
	/** Оценка 1–5 или null, если не оценено. */
	rating: number | null;
	/** Путь обложки из frontmatter ( cover ) или null. */
	cover: string | null;
	started: string | null;
	finished: string | null;
}

export interface StatusDef {
	id: ContentStatus;
	label: string;
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
		],
		progressField: null,
		progressTotalField: null,
		progressUnit: '',
		progressQuickSteps: [],
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
	{ id: 'planned', label: 'Запланировано' },
	{ id: 'in-progress', label: 'В работе' },
	{ id: 'finished', label: 'Завершено' },
	{ id: 'abandoned', label: 'Брошено' },
];

export function toStatus(value: unknown): ContentStatus {
	const status = STATUSES.find((s) => s.id === value);
	return status ? status.id : 'planned';
}

export function statusLabel(status: ContentStatus): string {
	return STATUSES.find((s) => s.id === status)?.label ?? status;
}
