import { type Menu, Notice, type TFile } from 'obsidian';
import { SUPPORTED_BOOK_EXTENSIONS } from '../core/book-import/types';
import { frontmatterRepository } from '../core/frontmatter';
import { writeCover, writeDescription, writeSource } from '../core/mutations';
import { createContentNote } from '../core/notes';
import { findSourceFile, isHttpSource, openSource } from '../core/source';
import type ContentLogPlugin from '../main';
import type { ContentItem } from '../types';
import { failLog, type CardActionRunner } from './action-errors';
import { BookImportModal } from './book-import-modal';
import { CoverSuggestModal } from './cover-picker';
import { CoverUrlModal } from './cover-url-modal';
import { SourceFileModal } from './source-file-modal';
import { TextInputModal } from './text-input-modal';

export function addCoverActions(
	menu: Menu,
	plugin: ContentLogPlugin,
	item: ContentItem,
	run: CardActionRunner,
): void {
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Обложка из хранилища…')
			.setIcon('image')
			.setSection('cover')
			.onClick(() => {
				new CoverSuggestModal(plugin.app, (path) => {
					run('cover update', writeCover(plugin.app, item, path), 'Не удалось обновить обложку');
				}).open();
			}),
	);
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Обложка по ссылке…')
			.setIcon('link')
			.setSection('cover')
			.onClick(() => {
				new CoverUrlModal(plugin.app, (url) => {
					run('cover update', writeCover(plugin.app, item, url), 'Не удалось обновить обложку');
				}).open();
			}),
	);
	if (item.cover) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Убрать обложку')
				.setIcon('trash')
				.setSection('cover')
				.onClick(() =>
					run('cover update', writeCover(plugin.app, item, null), 'Не удалось убрать обложку'),
			),
		);
	}
}

export function addSourceActions(
	menu: Menu,
	plugin: ContentLogPlugin,
	item: ContentItem,
	refresh: () => void,
	run: CardActionRunner,
): void {
	const source = item.source;
	const sourceFile = findSourceFile(plugin.app, item);
	if (sourceFile || isHttpSource(source ?? '')) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Открыть источник')
				.setIcon('external-link')
				.setSection('source')
				.onClick(() => void openSource(plugin, item)),
		);
	}
	if (
		item.type === 'book' &&
		sourceFile &&
		SUPPORTED_BOOK_EXTENSIONS.has(sourceFile.extension.toLowerCase())
	) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Извлечь данные из источника…')
				.setIcon('scan-text')
				.setSection('source')
				.onClick(() => void openBookImport(plugin, item, sourceFile, refresh)),
		);
	}
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Источник из файла…')
			.setIcon('file')
			.setSection('source')
			.onClick(() => {
				new SourceFileModal(plugin.app, (path) => {
					run('source update', writeSource(plugin.app, item, path), 'Не удалось обновить источник');
				}).open();
			}),
	);
	menu.addItem((menuItem) =>
		menuItem
			.setTitle(source ? 'Изменить источник…' : 'Указать источник…')
			.setIcon('pencil')
			.setSection('source')
			.onClick(() => {
				new TextInputModal(plugin.app, {
					title: 'Источник',
					value: source ?? '',
					placeholder: 'Ссылка или текст',
					onSave: (value) =>
						run(
							'source update',
							writeSource(plugin.app, item, value || null),
							'Не удалось обновить источник',
						),
				}).open();
			}),
	);
	if (source) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Убрать источник')
				.setIcon('trash')
				.setSection('source')
				.onClick(() =>
					run('source update', writeSource(plugin.app, item, null), 'Не удалось убрать источник'),
			),
		);
	}
}

export function addNoteActions(
	menu: Menu,
	plugin: ContentLogPlugin,
	item: ContentItem,
	run: CardActionRunner,
): void {
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Краткая заметка…')
			.setIcon('text')
			.setSection('notes')
			.onClick(() => {
				new TextInputModal(plugin.app, {
					title: 'Краткая заметка',
					value: item.description ?? '',
					multiline: true,
					placeholder: 'Пара слов о содержании',
					onSave: (value) =>
						run(
							'description update',
							writeDescription(plugin.app, item, value || null),
							'Не удалось обновить заметку',
						),
				}).open();
			}),
	);
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Новая заметка…')
			.setIcon('file-plus')
			.setSection('notes')
			.onClick(() => {
				void (async () => {
					const note = await createContentNote(plugin.app, item);
					if (note) await plugin.app.workspace.getLeaf('tab').openFile(note);
				})().catch(failLog('note creation', 'Не удалось создать заметку'));
			}),
	);
}

async function openBookImport(
	plugin: ContentLogPlugin,
	item: ContentItem,
	sourceFile: TFile,
	refresh: () => void,
): Promise<void> {
	const notice = new Notice('Извлекаю данные книги…', 0);
	try {
		const { extractBookFile } = await import('../core/book-import');
		const [extraction, current] = await Promise.all([
			extractBookFile(plugin.app, sourceFile),
			frontmatterRepository(plugin.app).read(item.file),
		]);
		notice.hide();
		new BookImportModal(plugin.app, item, extraction, current ?? {}, refresh).open();
	} catch (error) {
		notice.hide();
		console.error('content-log: book metadata extraction failed', error);
		new Notice('Не удалось извлечь данные книги');
	}
}
