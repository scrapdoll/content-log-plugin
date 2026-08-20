import { Menu, setIcon } from 'obsidian';
import type ContentLogPlugin from '../main';
import { UpdateProgressModal } from '../commands/progress';
import { RateContentModal } from '../commands/rating';
import {
	writeCover,
	writeDescription,
	writeHltb,
	writeProgress,
	writeSource,
} from '../core/mutations';
import { createContentNote } from '../core/notes';
import { getTypeSchema } from '../core/registry';
import { findSourceFile, isHttpSource, openSource } from '../core/source';
import type { ContentItem } from '../types';
import { failLog } from './action-errors';
import { CoverSuggestModal } from './cover-picker';
import { CoverUrlModal } from './cover-url-modal';
import { HltbSearchModal } from './hltb-search-modal';
import { SourceFileModal } from './source-file-modal';
import { TextInputModal } from './text-input-modal';

/** Меню «⋯» со всеми действиями над карточкой. */
export function buildCardActionsMenu(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const schema = getTypeSchema(item.type);
	const button = panel.createEl('button', {
		cls: 'cl-chip-button cl-card-more',
		attr: { 'aria-label': 'Действия' },
	});
	setIcon(button, 'more-horizontal');
	button.addEventListener('click', (evt) => {
		const menu = new Menu();

		if (schema?.progressField) {
			for (const step of schema.progressQuickSteps) {
				menu.addItem((menuItem) =>
					menuItem
						.setTitle(`Прибавить +${step} ${schema.progressUnit}`)
						.setIcon('plus')
						.setSection('progress')
						.onClick(() =>
							void writeProgress(
								plugin.app,
								item,
								(item.progress.current ?? 0) + step,
							)
								.then(refresh)
								.catch(failLog('progress update')),
						),
				);
			}
			menu.addItem((menuItem) =>
				menuItem
					.setTitle('Задать точный прогресс…')
					.setIcon('pencil')
					.setSection('progress')
					.onClick(() => {
						new UpdateProgressModal(plugin.app, item, refresh).open();
					}),
			);
		}

		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Оценить…')
				.setIcon('star')
				.setSection('rating')
				.onClick(() => {
					new RateContentModal(plugin.app, item, refresh).open();
				}),
		);

		if (item.type === 'game') {
			menu.addItem((menuItem) =>
				menuItem
					.setTitle('Найти на howlongtobeat.com…')
					.setIcon('gamepad-2')
					.setSection('hltb')
					.onClick(() => {
						new HltbSearchModal(plugin, item.title, (game) => {
							void writeHltb(plugin.app, item, game)
								.then(refresh)
								.catch(failLog('hltb update'));
						}).open();
					}),
			);
		}

		addCoverActions(menu, plugin, item, refresh);
		addSourceActions(menu, plugin, item, refresh);
		addNoteActions(menu, plugin, item, refresh);
		menu.showAtMouseEvent(evt);
	});
}

function addCoverActions(
	menu: Menu,
	plugin: ContentLogPlugin,
	item: ContentItem,
	refresh: () => void,
): void {
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Обложка из хранилища…')
			.setIcon('image')
			.setSection('cover')
			.onClick(() => {
				new CoverSuggestModal(plugin.app, (path) => {
					void writeCover(plugin.app, item, path)
						.then(refresh)
						.catch(failLog('cover update'));
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
					void writeCover(plugin.app, item, url)
						.then(refresh)
						.catch(failLog('cover update'));
				}).open();
			}),
	);
	if (item.cover) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Убрать обложку')
				.setIcon('trash')
				.setSection('cover')
				.onClick(() => {
					void writeCover(plugin.app, item, null)
						.then(refresh)
						.catch(failLog('cover update'));
				}),
		);
	}
}

function addSourceActions(
	menu: Menu,
	plugin: ContentLogPlugin,
	item: ContentItem,
	refresh: () => void,
): void {
	const source = item.source;
	if (findSourceFile(plugin.app, item) || isHttpSource(source ?? '')) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Открыть источник')
				.setIcon('external-link')
				.setSection('source')
				.onClick(() => {
					void openSource(plugin, item);
				}),
		);
	}
	menu.addItem((menuItem) =>
		menuItem
			.setTitle('Источник из файла…')
			.setIcon('file')
			.setSection('source')
			.onClick(() => {
				new SourceFileModal(plugin.app, (path) => {
					void writeSource(plugin.app, item, path)
						.then(refresh)
						.catch(failLog('source update'));
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
					onSave: (value) => {
						void writeSource(plugin.app, item, value || null)
							.then(refresh)
							.catch(failLog('source update'));
					},
				}).open();
			}),
	);
	if (source) {
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Убрать источник')
				.setIcon('trash')
				.setSection('source')
				.onClick(() => {
					void writeSource(plugin.app, item, null)
						.then(refresh)
						.catch(failLog('source update'));
				}),
		);
	}
}

function addNoteActions(
	menu: Menu,
	plugin: ContentLogPlugin,
	item: ContentItem,
	refresh: () => void,
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
					onSave: (value) => {
						void writeDescription(plugin.app, item, value || null)
							.then(refresh)
							.catch(failLog('description update'));
					},
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
				})().catch(failLog('note creation'));
			}),
	);
}
