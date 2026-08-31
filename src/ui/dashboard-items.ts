import { setIcon } from 'obsidian';
import type ContentLogPlugin from '../main';
import { resolveCoverSrc } from '../core/cover';
import { getTypeSchema } from '../core/registry';
import { statusLabel, type ContentItem } from '../types';
import { progressPercent, progressText } from '../utils/helpers';
import { hltbTimesText } from './dashboard-model';
import { appendSourceChip } from './source-chip';
import { buildCardActionsMenu } from './card-actions-menu';

export function renderDashboardItemRow(
	plugin: ContentLogPlugin,
	list: HTMLElement,
	item: ContentItem,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema) return;
	const row = list.createDiv({ cls: 'cl-item' });
	row.addEventListener('click', () => {
		void plugin.app.workspace.getLeaf('tab').openFile(item.file);
	});

	const coverSrc = resolveCoverSrc(plugin.app, item);
	if (coverSrc) {
		row.createEl('img', {
			cls: 'cl-item-cover',
			attr: { src: coverSrc, alt: item.title, loading: 'lazy' },
		});
	} else {
		setIcon(row.createDiv({ cls: 'cl-item-icon' }), schema.icon);
	}

	const main = row.createDiv({ cls: 'cl-item-main' });
	main.createDiv({ cls: 'cl-item-title', text: item.title });
	const subtitle = itemSubtitle(item, schema.subtitleField);
	if (subtitle) main.createDiv({ cls: 'cl-item-subtitle', text: subtitle });
	appendSourceChip(plugin, main, item);
	if (item.description) {
		main.createDiv({
			cls: 'cl-item-desc',
			text: item.description,
			attr: { title: item.description },
		});
	}
	const times = hltbTimesText(item);
	if (times) main.createDiv({ cls: 'cl-item-hltb', text: times });

	if (schema.progressField) renderProgress(row, 'cl-item-progress', item);
	renderRating(row, item);
	renderStatus(row, item);
	buildCardActionsMenu(plugin, row, item, () => undefined);
}

export function renderDashboardItemCard(
	plugin: ContentLogPlugin,
	list: HTMLElement,
	item: ContentItem,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema) return;
	const card = list.createDiv({ cls: 'cl-card-big' });
	card.addEventListener('click', () => {
		void plugin.app.workspace.getLeaf('tab').openFile(item.file);
	});

	const coverSrc = resolveCoverSrc(plugin.app, item);
	if (coverSrc) {
		card.createEl('img', {
			cls: 'cl-card-big-cover',
			attr: { src: coverSrc, alt: item.title, loading: 'lazy' },
		});
	} else {
		const placeholder = card.createDiv({
			cls: 'cl-card-big-cover cl-card-big-cover--empty',
		});
		setIcon(placeholder, schema.icon);
	}

	const body = card.createDiv({ cls: 'cl-card-big-body' });
	body.createDiv({ cls: 'cl-card-big-title', text: item.title });
	const subtitle = itemSubtitle(item, schema.subtitleField);
	if (subtitle) body.createDiv({ cls: 'cl-card-big-subtitle', text: subtitle });
	const times = hltbTimesText(item);
	if (times) body.createDiv({ cls: 'cl-card-big-hltb', text: times });
	if (item.description) {
		body.createDiv({
			cls: 'cl-card-big-desc',
			text: item.description,
			attr: { title: item.description },
		});
	}
	if (schema.progressField) renderProgress(body, 'cl-card-big-progress', item);

	const meta = body.createDiv({ cls: 'cl-card-big-meta' });
	appendSourceChip(plugin, meta, item);
	renderRating(meta, item);
	renderStatus(meta, item);
	buildCardActionsMenu(plugin, meta, item, () => undefined);
}

function itemSubtitle(item: ContentItem, field: string | null): string {
	return field ? String(item.fields[field] ?? '') : '';
}

function renderProgress(
	parent: HTMLElement,
	className: string,
	item: ContentItem,
): void {
	const progress = parent.createDiv({ cls: className });
	if (item.progress.total) {
		const bar = progress.createDiv({ cls: 'cl-progress' });
		const fill = bar.createDiv({ cls: 'cl-progress-fill' });
		fill.style.width = `${progressPercent(item)}%`;
	}
	progress.createDiv({ cls: 'cl-item-progress-label', text: progressText(item) });
}

function renderRating(parent: HTMLElement, item: ContentItem): void {
	if (item.rating === null) return;
	parent.createDiv({
		cls: 'cl-item-rating',
		text: '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating),
	});
}

function renderStatus(parent: HTMLElement, item: ContentItem): void {
	parent.createDiv({
		cls: `cl-status cl-status--${item.status}`,
		text: statusLabel(item.status),
	});
}
