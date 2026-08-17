import { App, Notice, TFile } from 'obsidian';
import type { ContentItem } from '../types';
import { ensureFolder, sanitizeName } from './scaffold';
import { renderNoteTemplate } from './templates';
import { todayISO } from '../utils/helpers';

/**
 * Создаёт заметку внутри папки Notes карточки контента:
 * <карточка>/Notes/YYYY-MM-DD <заголовок>.md с обратной ссылкой.
 */
export async function createContentNote(
	app: App,
	item: ContentItem,
	noteTitle = '',
): Promise<TFile | null> {
	const parentPath = item.file.parent?.path ?? '';
	const notesDir = parentPath ? `${parentPath}/Notes` : 'Notes';
	const cleaned = sanitizeName(noteTitle);
	const baseName = cleaned ? `${todayISO()} ${cleaned}` : todayISO();

	let path = `${notesDir}/${baseName}.md`;
	let counter = 2;
	while (app.vault.getAbstractFileByPath(path)) {
		path = `${notesDir}/${baseName} (${counter}).md`;
		counter++;
	}

	try {
		await ensureFolder(app.vault, notesDir);
		return await app.vault.create(
			path,
			renderNoteTemplate(item.file.basename),
		);
	} catch (error) {
		new Notice('Не удалось создать заметку');
		console.error('content-log: note creation failed', error);
		return null;
	}
}
