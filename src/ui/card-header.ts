import { Menu, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { parseContentItem } from '../core/index';
import { writeProgress, writeStatus, writeRating, writeCover } from '../core/mutations';
import { createContentNote } from '../core/notes';
import { getTypeSchema, isKnownType } from '../core/registry';
import { UpdateProgressModal } from '../commands/progress';
import {
	STATUSES,
	type ContentItem,
	statusLabel,
} from '../types';
import { progressPercent, progressText } from '../utils/helpers';
import { CoverSuggestModal } from './cover-picker';

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

		buildCardHeaderPanel(plugin, el, item);
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

	buildStatusPill(plugin, panel, item);

	if (schema.progressField) {
		buildProgressControls(plugin, panel, item);
	}

	buildRatingStars(plugin, panel, item);
	buildCoverButton(plugin, panel, item);
	buildNoteButton(plugin, panel, item);
}

function buildStatusPill(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
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
						void writeStatus(plugin.app, item, status.id).catch(
							(error) => {
								console.error(
									'content-log: status update failed',
									error,
								);
							},
						),
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
			).catch((error) => {
				console.error('content-log: progress update failed', error);
			}),
		);
	}
	const exactButton = panel.createEl('button', {
		cls: 'cl-chip-button',
		text: '…',
		attr: { 'aria-label': 'Задать точное значение' },
	});
	exactButton.addEventListener('click', () => {
		new UpdateProgressModal(plugin.app, item).open();
	});
}

function buildRatingStars(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
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
			).catch((error) => {
				console.error('content-log: rating update failed', error);
			}),
		);
	}
}

function buildCoverButton(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
): void {
	const button = panel.createEl('button', {
		cls: 'cl-chip-button',
		text: 'Обложка',
	});
	button.addEventListener('click', () => {
		new CoverSuggestModal(plugin.app, (path) => {
			void writeCover(plugin.app, item, path).catch((error) => {
				console.error('content-log: cover update failed', error);
			});
		}).open();
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
