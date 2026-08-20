import type {
	BookFieldValue,
	ExtractedBookField,
	RawBookMetadata,
} from './types';

const MAX_SHORT_TEXT = 500;
const MAX_DESCRIPTION = 20_000;
const MAX_LIST_ITEMS = 500;

const FIELD_DEFS: Array<{
	key: string;
	label: string;
	origin: ExtractedBookField['origin'];
	confidence: ExtractedBookField['confidence'];
	value: (metadata: RawBookMetadata) => BookFieldValue | undefined;
}> = [
	{
		key: 'title',
		label: 'Название',
		origin: 'embedded',
		confidence: 'high',
		value: (metadata) => cleanText(metadata.title),
	},
	{
		key: 'author',
		label: 'Автор',
		origin: 'embedded',
		confidence: 'high',
		value: (metadata) => cleanList(metadata.authors, 20).join(', ') || undefined,
	},
	{
		key: 'language',
		label: 'Язык',
		origin: 'embedded',
		confidence: 'high',
		value: (metadata) => cleanText(metadata.language),
	},
	{
		key: 'publisher',
		label: 'Издатель',
		origin: 'embedded',
		confidence: 'high',
		value: (metadata) => cleanText(metadata.publisher),
	},
	{
		key: 'published',
		label: 'Дата публикации',
		origin: 'embedded',
		confidence: 'medium',
		value: (metadata) => cleanText(metadata.published),
	},
	{
		key: 'isbn',
		label: 'ISBN',
		origin: 'embedded',
		confidence: 'high',
		value: (metadata) => cleanText(metadata.isbn),
	},
	{
		key: 'identifiers',
		label: 'Идентификаторы',
		origin: 'embedded',
		confidence: 'medium',
		value: (metadata) => nonEmptyList(metadata.identifiers, 20),
	},
	{
		key: 'series',
		label: 'Серия',
		origin: 'embedded',
		confidence: 'medium',
		value: (metadata) => cleanText(metadata.series),
	},
	{
		key: 'series-index',
		label: 'Номер в серии',
		origin: 'embedded',
		confidence: 'medium',
		value: (metadata) => cleanText(metadata.seriesIndex),
	},
	{
		key: 'description',
		label: 'Описание',
		origin: 'embedded',
		confidence: 'medium',
		value: (metadata) => cleanText(metadata.description, MAX_DESCRIPTION),
	},
	{
		key: 'subjects',
		label: 'Темы и жанры',
		origin: 'embedded',
		confidence: 'medium',
		value: (metadata) => nonEmptyList(metadata.subjects, 50),
	},
	{
		key: 'pages-total',
		label: 'Всего страниц',
		origin: 'structure',
		confidence: 'high',
		value: (metadata) => positiveInteger(metadata.pageCount),
	},
	{
		key: 'chapters-total',
		label: 'Глав по содержанию',
		origin: 'structure',
		confidence: 'medium',
		value: (metadata) => positiveInteger(metadata.chapterCount),
	},
	{
		key: 'table-of-contents',
		label: 'Содержание',
		origin: 'structure',
		confidence: 'medium',
		value: (metadata) => nonEmptyList(metadata.toc, MAX_LIST_ITEMS),
	},
];

/** Нормализует данные адаптера в ограниченный набор полей frontmatter. */
export function metadataToFields(metadata: RawBookMetadata): ExtractedBookField[] {
	const fields: ExtractedBookField[] = [];
	for (const definition of FIELD_DEFS) {
		const value = definition.value(metadata);
		if (value === undefined || value === '' || isEmptyArray(value)) continue;
		fields.push({
			key: definition.key,
			label: definition.label,
			value,
			origin: definition.origin,
			confidence: definition.confidence,
		});
	}
	return fields;
}

export function cleanText(
	value: string | undefined,
	maxLength = MAX_SHORT_TEXT,
): string | undefined {
	if (!value) return undefined;
	const text = value.replace(/\s+/g, ' ').trim();
	return text ? text.slice(0, maxLength) : undefined;
}

export function cleanList(
	values: string[] | undefined,
	maxItems = MAX_LIST_ITEMS,
): string[] {
	const result: string[] = [];
	const seen = new Set<string>();
	for (const value of values ?? []) {
		const text = cleanText(value);
		if (!text) continue;
		const normalized = text.toLocaleLowerCase();
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(text);
		if (result.length >= maxItems) break;
	}
	return result;
}

export function findIsbn(values: string[] | undefined): string | undefined {
	for (const value of values ?? []) {
		const match = /(?:ISBN(?:-1[03])?\s*:?\s*)?((?:97[89][\s-]?)?\d[\d\s-]{8,}[\dXx])/i.exec(
			value,
		);
		if (!match?.[1]) continue;
		const compact = match[1].replace(/[\s-]/g, '').toUpperCase();
		if (compact.length === 10 || compact.length === 13) return compact;
	}
	return undefined;
}

function nonEmptyList(
	values: string[] | undefined,
	maxItems: number,
): string[] | undefined {
	const list = cleanList(values, maxItems);
	return list.length > 0 ? list : undefined;
}

function positiveInteger(value: number | undefined): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) && value > 0
		? value
		: undefined;
}

function isEmptyArray(value: BookFieldValue): boolean {
	return Array.isArray(value) && value.length === 0;
}
