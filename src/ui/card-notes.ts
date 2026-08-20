import { setIcon, type App, type TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { createContentNote } from '../core/notes';
import type { ContentItem } from '../types';
import { failLog } from './action-errors';

/** Список заметок карточки в стиле строк дашборда. */
export function buildCardNotesSection(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
): void {
	const notes = listNoteFiles(plugin.app, item);
	if (notes.length === 0) return;

	const section = panel.createDiv({ cls: 'cl-card-notes' });
	const head = section.createDiv({ cls: 'cl-card-notes-head' });
	head.createSpan({ text: `Заметки (${notes.length})` });
	const addButton = head.createEl('button', {
		cls: 'cl-chip-button',
		text: '+',
		attr: { 'aria-label': 'Новая заметка' },
	});
	addButton.addEventListener('click', () => {
		void (async () => {
			const note = await createContentNote(plugin.app, item);
			if (note) await plugin.app.workspace.getLeaf('tab').openFile(note);
		})().catch(failLog('note creation', 'Не удалось создать заметку'));
	});

	const list = section.createDiv({ cls: 'cl-card-notes-list' });
	for (const note of notes) {
		const noteRow = list.createDiv({ cls: 'cl-item' });
		noteRow.addEventListener('click', () => {
			void plugin.app.workspace.getLeaf('tab').openFile(note);
		});
		setIcon(noteRow.createDiv({ cls: 'cl-item-icon' }), 'file-text');
		const main = noteRow.createDiv({ cls: 'cl-item-main' });
		main.createDiv({ cls: 'cl-item-title', text: note.basename });
		main.createDiv({
			cls: 'cl-item-subtitle',
			text: new Date(note.stat.mtime).toLocaleDateString('ru-RU'),
		});
	}
}

function listNoteFiles(app: App, item: ContentItem): TFile[] {
	const folder = item.file.parent;
	if (!folder) return [];
	const notesDir = `${folder.path}/Notes`;
	return app.vault
		.getFiles()
		.filter((file) => file.parent?.path === notesDir)
		.sort((a, b) => b.stat.mtime - a.stat.mtime);
}
