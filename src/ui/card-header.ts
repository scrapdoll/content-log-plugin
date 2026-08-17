import { Menu, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { contentItemFromFrontmatter, parseContentItem } from '../core/index';
import {
	writeProgress,
	writeStatus,
	writeRating,
	writeCover,
} from '../core/mutations';
import { createContentNote } from '../core/notes';
import { getTypeSchema, isKnownType } from '../core/registry';
import { UpdateProgressModal } from '../commands/progress';
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

/**
 * Интерактивная шапка карточки: статус-пилюля с меню, прогресс-бар,
 * быстрые кнопки, оценка звёздами и обложка. Используется в reading view
 * ( post processor ) и в live preview ( CM6 widget ).
 */
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
}

/** Строит панель шапки в переданный контейнер. */
export function buildCardHeaderPanel(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	item: ContentItem,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema) return;

	const panel = container.createDiv({ cls: 'cl-card-header' });
	const refresh = () => void rerenderPanel(plugin, container, item.file);

	buildStatusPill(plugin, panel, item, refresh);

	if (schema.progressField) {
		buildProgressControls(plugin, panel, item, refresh);
	}

	buildRatingStars(plugin, panel, item, refresh);
	buildCoverButton(plugin, panel, item, refresh);
	buildNoteButton(plugin, panel, item);
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
	panel: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const statusPill = panel.createDiv({
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

function buildProgressControls(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema?.progressField) return;

	if (item.progress.total) {
		const bar = panel.createDiv({ cls: 'cl-progress' });
		const fill = bar.createDiv({ cls: 'cl-progress-fill' });
		fill.style.width = `${progressPercent(item)}%`;
	}
	panel.createSpan({
		cls: 'cl-card-progress-label',
		text: progressText(item),
	});
	for (const step of schema.progressQuickSteps) {
		const button = panel.createEl('button', {
			cls: 'cl-chip-button',
			text: `+${step} ${schema.progressUnit}`,
		});
		button.addEventListener('click', () =>
			void writeProgress(
				plugin.app,
				item,
				(item.progress.current ?? 0) + step,
			)
				.then(refresh)
				.catch(failLog('progress update')),
		);
	}
	const exactButton = panel.createEl('button', {
		cls: 'cl-chip-button',
		text: '…',
		attr: { 'aria-label': 'Задать точное значение' },
	});
	exactButton.addEventListener('click', () => {
		new UpdateProgressModal(plugin.app, item, refresh).open();
	});
}

function buildRatingStars(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const rating = panel.createDiv({ cls: 'cl-rating' });
	for (let star = 1; star <= 5; star++) {
		const filled = item.rating !== null && star <= item.rating;
		const button = rating.createEl('button', {
			cls: `cl-star${filled ? ' is-filled' : ''}`,
			text: '★',
			attr: { 'aria-label': `Оценка ${star}` },
		});
		button.addEventListener('click', () =>
			void writeRating(
				plugin.app,
				item,
				item.rating === star ? 0 : star,
			)
				.then(refresh)
				.catch(failLog('rating update')),
		);
	}
}

function buildCoverButton(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const button = panel.createEl('button', {
		cls: 'cl-chip-button',
		text: 'Обложка',
	});
	button.addEventListener('click', (evt) => {
		const menu = new Menu();
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Из хранилища…')
				.setIcon('image')
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
				.setTitle('По ссылке…')
				.setIcon('link')
				.onClick(() => {
					new CoverUrlModal(plugin.app, (url) => {
						void writeCover(plugin.app, item, url)
							.then(refresh)
							.catch(failLog('cover update'));
					}).open();
				}),
		);
		if (item.cover) {
			menu.addSeparator();
			menu.addItem((menuItem) =>
				menuItem
					.setTitle('Убрать обложку')
					.setIcon('trash')
					.onClick(() => {
						void writeCover(plugin.app, item, null)
							.then(refresh)
							.catch(failLog('cover update'));
					}),
			);
		}
		menu.showAtMouseEvent(evt);
	});
}

function buildNoteButton(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
): void {
	const button = panel.createEl('button', {
		cls: 'cl-chip-button',
		text: 'Заметка',
	});
	button.addEventListener('click', () =>
		void (async () => {
			const note = await createContentNote(plugin.app, item);
			if (note) {
				await plugin.app.workspace.getLeaf('tab').openFile(note);
			}
		})().catch((error) => {
			console.error('content-log: note creation failed', error);
		}),
	);
}
