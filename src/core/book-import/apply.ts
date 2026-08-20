import { Notice, type App } from 'obsidian';
import type { ContentItem } from '../../types';
import { frontmatterRepository, type Frontmatter } from '../frontmatter';
import { applyProgressChange } from '../frontmatter-transitions';
import { getTypeSchema } from '../registry';
import { sanitizeName } from '../scaffold';
import { todayISO } from '../../utils/helpers';
import type {
	BookExtractionResult,
	BookFieldValue,
	ExtractedBookField,
} from './types';

const SAFE_COVER_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

/** Применяет только явно выбранные кандидаты и не удаляет остальные поля. */
export async function applyBookExtraction(
	app: App,
	item: ContentItem,
	extraction: BookExtractionResult,
	selectedKeys: ReadonlySet<string>,
): Promise<number> {
	let coverPath: string | undefined;
	if (selectedKeys.has('cover') && extraction.cover) {
		coverPath = await saveEmbeddedCover(app, item, extraction);
	}
	const selectedFields = extraction.fields.filter((field) => selectedKeys.has(field.key));
	if (selectedFields.length === 0 && !coverPath) return 0;

	await frontmatterRepository(app).update(item.file, (frontmatter) => {
		applySelectedBookFields(frontmatter, selectedFields);
		clampImportedProgress(item, frontmatter, selectedFields);
		if (coverPath) frontmatter['cover'] = coverPath;
	});
	const count = selectedFields.length + (coverPath ? 1 : 0);
	new Notice(`Применено полей: ${count}`);
	return count;
}

function clampImportedProgress(
	item: ContentItem,
	frontmatter: Frontmatter,
	fields: ExtractedBookField[],
): void {
	const schema = getTypeSchema(item.type);
	if (!schema?.progressField || !schema.progressTotalField) return;
	const importedTotal = fields.find(
		(field) => field.key === schema.progressTotalField,
	)?.value;
	const current = frontmatter[schema.progressField];
	if (
		typeof importedTotal !== 'number' ||
		typeof current !== 'number' ||
		!Number.isFinite(current) ||
		current <= importedTotal
	) {
		return;
	}
	applyProgressChange(
		frontmatter,
		{
			progressField: schema.progressField,
			progressTotalField: schema.progressTotalField,
		},
		importedTotal,
		todayISO(),
	);
}

export function applySelectedBookFields(
	frontmatter: Frontmatter,
	fields: ExtractedBookField[],
): void {
	for (const field of fields) frontmatter[field.key] = cloneValue(field.value);
}

export function bookFieldValueEquals(
	current: unknown,
	extracted: BookFieldValue,
): boolean {
	if (Array.isArray(extracted)) {
		return (
			Array.isArray(current) &&
			current.length === extracted.length &&
			current.every((value, index) => value === extracted[index])
		);
	}
	return current === extracted;
}

function cloneValue(value: BookFieldValue): BookFieldValue {
	return Array.isArray(value) ? [...value] : value;
}

async function saveEmbeddedCover(
	app: App,
	item: ContentItem,
	extraction: BookExtractionResult,
): Promise<string | undefined> {
	const cover = extraction.cover;
	if (!cover || !SAFE_COVER_EXTENSIONS.has(cover.extension)) return undefined;
	const folder = item.file.parent?.path;
	if (!folder) return undefined;
	const stem = sanitizeName(`${item.file.basename}-cover`) || 'book-cover';
	let path = `${folder}/${stem}.${cover.extension}`;
	let suffix = 2;
	while (app.vault.getAbstractFileByPath(path)) {
		path = `${folder}/${stem}-${suffix}.${cover.extension}`;
		suffix++;
	}
	const copy = Uint8Array.from(cover.bytes);
	await app.vault.createBinary(path, copy.buffer);
	return path;
}
