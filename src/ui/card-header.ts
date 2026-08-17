import { Menu, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { parseContentItem } from '../core/index';
import { writeProgress, writeStatus } from '../core/mutations';
import { createContentNote } from '../core/notes';
import { getTypeSchema, isKnownType } from '../core/registry';
import { UpdateProgressModal } from '../commands/progress';
import {
	STATUSES,
	type ContentItem,
	statusLabel,
} from '../types';
import { progressPercent, progressText } from '../utils/helpers';

/**
 * Интерактивная шапка карточки в режиме чтения: статус-пилюля с меню,
 * прогресс-бар и быстрые кнопки. Работает в reading view, превью и эмбедах;
 * в live preview не отображается.
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

		renderCardHeader(plugin, el, item);
	});
}

function renderCardHeader(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	item: ContentItem,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema) return;

	const panel = container.createDiv({ cls: 'cl-card-header' });

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

	if (schema.progressField) {
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

	const noteButton = panel.createEl('button', {
		cls: 'cl-chip-button',
		text: 'Заметка',
	});
	noteButton.addEventListener('click', () =>
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
