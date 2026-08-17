import { App, Notice, TFile, Vault } from 'obsidian';
import { getTypeSchema } from './registry';
import {
	type ContentStatus,
	type ContentTypeId,
} from '../types';
import { renderCardTemplate } from './templates';
import { normalizeRoot, todayISO } from '../utils/helpers';

export interface NewContentInput {
	type: ContentTypeId;
	title: string;
	status: ContentStatus;
	fields: Record<string, string | number>;
	cover?: string | null;
}

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|#^[\]]/g;

export function sanitizeName(name: string): string {
	return name
		.replace(ILLEGAL_FILENAME_CHARS, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[. ]+$/, '')
		.slice(0, 100);
}

export async function ensureFolder(
	vault: Vault,
	path: string,
): Promise<void> {
	if (!path || path === '/') return;
	if (!vault.getAbstractFileByPath(path)) {
		await vault.createFolder(path);
	}
}

/**
 * Создаёт для единицы контента папку с карточкой и подпапкой Notes:
 * <root>/<Books>/<Название>/<Название>.md
 */
export async function createContentItem(
	app: App,
	rootFolder: string,
	input: NewContentInput,
): Promise<TFile | null> {
	const schema = getTypeSchema(input.type);
	if (!schema) {
		new Notice('Неизвестный тип контента');
		return null;
	}
	const root = normalizeRoot(rootFolder);
	if (!root) {
		new Notice('Укажите корневую папку в настройках плагина');
		return null;
	}

	const title = sanitizeName(input.title);
	if (!title) {
		new Notice('Введите название');
		return null;
	}

	const { vault } = app;
	const folderName = pickUniqueFolderName(
		vault,
		`${root}/${schema.folder}`,
		title,
		typeof input.fields['year'] === 'number'
			? input.fields['year']
			: null,
	);
	const itemFolder = `${root}/${schema.folder}/${folderName}`;

	await ensureFolder(vault, root);
	await ensureFolder(vault, `${root}/${schema.folder}`);
	await ensureFolder(vault, itemFolder);
	await ensureFolder(vault, `${itemFolder}/Notes`);

	const file = await vault.create(
		`${itemFolder}/${folderName}.md`,
		renderCardTemplate(input.type, { title }),
	);

	await app.fileManager.processFrontMatter(
		file,
		(fm: Record<string, unknown>) => {
		fm['type'] = input.type;
		fm['title'] = title;
		fm['status'] = input.status;
		for (const field of schema.fields) {
			const value = input.fields[field.key];
			if (value !== undefined && value !== '') {
				fm[field.key] = value;
			}
		}
		if (input.cover) {
			fm['cover'] = input.cover;
		}
		if (input.status === 'in-progress' || input.status === 'finished') {
			fm['started'] = todayISO();
			if (input.status === 'finished') fm['finished'] = todayISO();
		}
	},
	);

	return file;
}

function pickUniqueFolderName(
	vault: Vault,
	typeDir: string,
	title: string,
	year: number | null,
): string {
	const taken = (name: string) =>
		vault.getAbstractFileByPath(`${typeDir}/${name}`) !== null;

	if (!taken(title)) return title;
	if (year !== null && !taken(`${title} (${year})`)) {
		return `${title} (${year})`;
	}
	let counter = 2;
	while (taken(`${title} (${counter})`)) counter++;
	return `${title} (${counter})`;
}
