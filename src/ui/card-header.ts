import { App, Menu, setIcon, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { contentItemFromFrontmatter, parseContentItem } from '../core/index';
import {
	writeProgress,
	writeStatus,
	writeCover,
	writeSource,
	writeDescription,
	writeHltb,
} from '../core/mutations';
import { createContentNote } from '../core/notes';
import { resolveCoverSrc } from '../core/cover';
import { findSourceFile, isHttpSource, openSource } from '../core/source';
import { formatHours, hltbGameUrl } from '../core/hltb';
import { getTypeSchema, isKnownType } from '../core/registry';
import { UpdateProgressModal } from '../commands/progress';
import { RateContentModal } from '../commands/rating';
import {
	STATUSES,
	type ContentItem,
	statusLabel,
} from '../types';
import {
	parseFrontmatterText,
	progressPercent,
	progressText,
} from '../utils/helpers';
import { CoverSuggestModal } from './cover-picker';
import { CoverUrlModal } from './cover-url-modal';
import { HltbSearchModal } from './hltb-search-modal';
import { appendSourceChip } from './source-chip';
import { SourceFileModal } from './source-file-modal';
import { TextInputModal } from './text-input-modal';

/**
 * Интерактивная шапка карточки: обложка, статус, прогресс и список
 * заметок. Все действия скрыты в меню «⋯». Используется в reading view
 * ( post processor ) и в live preview ( CM6 widget ).
 */

interface CardMount {
	file: TFile;
	plugin: ContentLogPlugin;
}

/** Живые шапки: контейнер → карточка, для обновления по событию индекса. */
const activeMounts = new Map<HTMLElement, CardMount>();

export function registerCardHeader(plugin: ContentLogPlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const fm = ctx.frontmatter as Record<string, unknown> | undefined;
		const type = fm?.['type'];
		if (!isKnownType(type)) return;

		// Шапку размещаем в секции с заголовком карточки.
		const h1 = el.querySelector('h1');
		if (!h1) return;

		const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;
		const item =
			plugin.index.get(file) ?? parseContentItem(plugin.app, file);
		if (!item) return;

		// Отдельный контейнер, чтобы перерисовывать панель после записей.
		const mount = el.createDiv();
		buildCardHeaderPanel(plugin, mount, item);
	});

	// Заметки и обложки меняются без правки карточки — обновляем шапки
	// при любом изменении индекса ( он слушает весь корень плагина ).
	plugin.registerEvent(
		plugin.index.on('changed', () => {
			for (const [container, info] of [...activeMounts]) {
				if (!container.isConnected) {
					activeMounts.delete(container);
					continue;
				}
				void rerenderPanel(info.plugin, container, info.file);
			}
		}),
	);
}

/** Строит панель шапки в переданный контейнер. */
export function buildCardHeaderPanel(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	item: ContentItem,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema) return;

	activeMounts.set(container, { file: item.file, plugin });

	const panel = container.createDiv({ cls: 'cl-card-header' });
	const refresh = () => void rerenderPanel(plugin, container, item.file);

	const coverSrc = resolveCoverSrc(plugin.app, item);
	if (coverSrc) {
		panel.createEl('img', {
			cls: 'cl-card-cover',
			attr: {
				src: coverSrc,
				alt: item.title,
				loading: 'lazy',
			},
		});
	}

	const info = panel.createDiv({ cls: 'cl-card-info' });
	const row = info.createDiv({ cls: 'cl-card-info-row' });
	buildStatusPill(plugin, row, item, refresh);
	if (schema.progressField) {
		buildProgressDisplay(row, item);
	}
	if (item.rating !== null) {
		buildRatingDisplay(plugin, row, item, refresh);
	}
	buildHltbDisplay(plugin, info, item, refresh);
	appendSourceChip(plugin, info, item);
	if (item.description) {
		info.createDiv({
			cls: 'cl-card-desc',
			text: item.description,
			attr: { title: item.description },
		});
	}

	buildActionsMenu(plugin, panel, item, refresh);
	buildNotesSection(plugin, panel, item);
}

/**
 * Перечитывает карточку с диска и строит панель заново: Obsidian не
 * перезапускает post processor при изменении только frontmatter.
 */
async function rerenderPanel(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	file: TFile,
): Promise<void> {
	const fm = parseFrontmatterText(await plugin.app.vault.read(file));
	if (!fm) return;
	const item = contentItemFromFrontmatter(file, fm);
	if (!item) return;
	container.empty();
	buildCardHeaderPanel(plugin, container, item);
}

function failLog(scope: string): (error: unknown) => void {
	return (error) => console.error(`content-log: ${scope} failed`, error);
}

function buildStatusPill(
	plugin: ContentLogPlugin,
	row: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const statusPill = row.createDiv({
		cls: `cl-status cl-status--${item.status} cl-card-status`,
		text: statusLabel(item.status),
	});
	statusPill.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const status of STATUSES) {
			menu.addItem((menuItem) =>
				menuItem
					.setTitle(status.label)
					.setChecked(status.id === item.status)
					.onClick(() =>
						void writeStatus(plugin.app, item, status.id)
							.then(refresh)
							.catch(failLog('status update')),
					),
			);
		}
		menu.showAtMouseEvent(evt);
	});
}

function buildProgressDisplay(row: HTMLElement, item: ContentItem): void {
	if (item.progress.total) {
		const bar = row.createDiv({ cls: 'cl-progress' });
		const fill = bar.createDiv({ cls: 'cl-progress-fill' });
		fill.style.width = `${progressPercent(item)}%`;
	}
	row.createSpan({
		cls: 'cl-card-progress-label',
		text: progressText(item),
	});
}

function buildRatingDisplay(
	plugin: ContentLogPlugin,
	row: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const rating = item.rating ?? 0;
	const stars = row.createEl('button', {
		cls: 'cl-card-rating',
		text: '★'.repeat(rating) + '☆'.repeat(5 - rating),
		attr: { 'aria-label': 'Изменить оценку' },
	});
	stars.addEventListener('click', () => {
		new RateContentModal(plugin.app, item, refresh).open();
	});
}

/**
 * Виджет HowLongToBeat: времена прохождения и ссылка на страницу игры.
 * Пока данных нет, для игр вместо виджета показывается кнопка генерации.
 */
function buildHltbDisplay(
	plugin: ContentLogPlugin,
	info: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const hltb = item.hltb;
	if (!hltb) {
		if (item.type !== 'game') return;
		const button = info.createEl('button', {
			cls: 'cl-chip-button cl-hltb-generate',
			attr: { 'aria-label': 'Найти данные игры на howlongtobeat.com' },
		});
		setIcon(button, 'gamepad-2');
		button.createSpan({ text: 'Заполнить из howlongtobeat.com…' });
		button.addEventListener('click', () => {
			new HltbSearchModal(plugin, item.title, (game) => {
				void writeHltb(plugin.app, item, game)
					.then(refresh)
					.catch(failLog('hltb update'));
			}).open();
		});
		return;
	}

	const block = info.createDiv({ cls: 'cl-hltb' });
	const cell = (label: string, hours: number | null): void => {
		const element = block.createDiv({ cls: 'cl-hltb-cell' });
		element.createSpan({ cls: 'cl-hltb-label', text: label });
		element.createSpan({ cls: 'cl-hltb-value', text: formatHours(hours) });
	};
	cell('Сюжет', hltb.main);
	cell('+ дополнения', hltb.extra);
	cell('100%', hltb.complete);
	if (hltb.id !== null) {
		block.createEl('a', {
			cls: 'cl-hltb-link',
			text: 'Открыть на howlongtobeat.com',
			attr: {
				href: hltbGameUrl(hltb.id),
				target: '_blank',
				rel: 'noopener',
				title: 'Страница игры',
			},
		});
	}
}

/** Меню «⋯» со всеми действиями над карточкой. */
function buildActionsMenu(
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
		const source = item.source;

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
							new HltbSearchModal(
								plugin,
								item.title,
								(game) => {
									void writeHltb(plugin.app, item, game)
										.then(refresh)
										.catch(failLog('hltb update'));
								},
							).open();
						}),
				);
			}

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
						if (note) {
							await plugin.app.workspace.getLeaf('tab').openFile(note);
						}
					})().catch(failLog('note creation'));
				}),
		);

		menu.showAtMouseEvent(evt);
	});
}

/** Список заметок карточки в стиле строк дашборда. */
function buildNotesSection(
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
			if (note) {
				await plugin.app.workspace.getLeaf('tab').openFile(note);
			}
		})().catch(failLog('note creation'));
	});

	const list = section.createDiv({ cls: 'cl-card-notes-list' });
	for (const note of notes) {
		const noteRow = list.createDiv({ cls: 'cl-item' });
		noteRow.addEventListener('click', () => {
			void plugin.app.workspace.getLeaf('tab').openFile(note);
		});
		const icon = noteRow.createDiv({ cls: 'cl-item-icon' });
		setIcon(icon, 'file-text');
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
