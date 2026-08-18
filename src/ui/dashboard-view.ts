import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';
import type ContentLogPlugin from '../main';
import { exportDashboardMarkdown } from '../commands/export';
import { resolveCoverSrc } from '../core/cover';
import { getAllTypeSchemas, getTypeSchema } from '../core/registry';
import {
	STATUSES,
	type ContentItem,
	type ContentStatus,
	statusLabel,
} from '../types';
import { progressPercent, progressText } from '../utils/helpers';
import { AddContentModal } from './add-content-modal';
import { appendSourceChip } from './source-chip';

export const VIEW_TYPE_CONTENT_DASHBOARD = 'content-log-dashboard';

/** 'All' либо id типа контента. */
type TypeFilter = string;
type StatusFilter = ContentStatus | 'All';
type SortKey = 'Updated' | 'Title' | 'Progress';
type ViewMode = 'List' | 'Cards';

const MONTH_LABELS = [
	'янв',
	'фев',
	'мар',
	'апр',
	'май',
	'июн',
	'июл',
	'авг',
	'сен',
	'окт',
	'ноя',
	'дек',
];

/** Живой дашборд со всем контентом: статистика, график, фильтры, обложки. */
export class ContentDashboardView extends ItemView {
	private filterType: TypeFilter = 'All';
	private filterStatus: StatusFilter = 'All';
	private filterRating = 'All';
	private sortBy: SortKey = 'Updated';
	private viewMode: ViewMode = 'List';
	private listEl: HTMLElement | null = null;

	private readonly changeHandler = () => this.render();

	constructor(leaf: WorkspaceLeaf, private plugin: ContentLogPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CONTENT_DASHBOARD;
	}

	getDisplayText(): string {
		return 'Content log';
	}

	getIcon(): string {
		return 'library';
	}

	async onOpen(): Promise<void> {
		this.plugin.index.on('changed', this.changeHandler);
		this.render();
	}

	async onClose(): Promise<void> {
		this.plugin.index.off('changed', this.changeHandler);
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-dashboard');
		this.renderHeader();
		this.renderStats();
		this.renderChart();
		this.listEl = contentEl.createDiv({ cls: 'cl-list' });
		this.renderList();
	}

	private renderHeader(): void {
		const header = this.contentEl.createDiv({ cls: 'cl-header' });

		const addButton = header.createEl('button', {
			cls: 'mod-cta',
			text: '+ Добавить',
		});
		addButton.addEventListener('click', () => {
			new AddContentModal(this.app, this.plugin).open();
		});

		const exportButton = header.createEl('button', {
			text: 'Экспорт .md',
		});
		exportButton.addEventListener('click', () => {
			void exportDashboardMarkdown(this.plugin);
		});

		const typeSelect = header.createEl('select');
		this.addOption(typeSelect, 'All', 'Все типы');
		for (const schema of getAllTypeSchemas()) {
			this.addOption(typeSelect, schema.id, schema.label);
		}
		typeSelect.value = this.filterType;
		typeSelect.addEventListener('change', () => {
			this.filterType = typeSelect.value;
			this.render();
		});

		const statusSelect = header.createEl('select');
		this.addOption(statusSelect, 'All', 'Все статусы');
		for (const status of STATUSES) {
			this.addOption(statusSelect, status.id, status.label);
		}
		statusSelect.value = this.filterStatus;
		statusSelect.addEventListener('change', () => {
			this.filterStatus = statusSelect.value as ContentStatus;
			this.render();
		});

		const ratingSelect = header.createEl('select');
		this.addOption(ratingSelect, 'All', 'Любая оценка');
		for (let star = 1; star <= 5; star++) {
			this.addOption(ratingSelect, String(star), `${'★'.repeat(star)} и выше`);
		}
		ratingSelect.value = this.filterRating;
		ratingSelect.addEventListener('change', () => {
			this.filterRating = ratingSelect.value;
			this.renderList();
		});

		const sortSelect = header.createEl('select');
		this.addOption(sortSelect, 'Updated', 'По обновлению');
		this.addOption(sortSelect, 'Title', 'По названию');
		this.addOption(sortSelect, 'Progress', 'По прогрессу');
		sortSelect.value = this.sortBy;
		sortSelect.addEventListener('change', () => {
			this.sortBy = sortSelect.value as SortKey;
			this.renderList();
		});

		const toggle = header.createDiv({ cls: 'cl-view-toggle' });
		const listButton = toggle.createEl('button', {
			cls: 'cl-view-toggle-button',
			attr: { 'aria-label': 'Список' },
		});
		setIcon(listButton, 'list');
		const cardsButton = toggle.createEl('button', {
			cls: 'cl-view-toggle-button',
			attr: { 'aria-label': 'Карточки' },
		});
		setIcon(cardsButton, 'layout-grid');
		if (this.viewMode === 'List') {
			listButton.addClass('is-active');
		} else {
			cardsButton.addClass('is-active');
		}
		listButton.addEventListener('click', () => {
			this.viewMode = 'List';
			this.render();
		});
		cardsButton.addEventListener('click', () => {
			this.viewMode = 'Cards';
			this.render();
		});
	}

	private addOption(
		select: HTMLSelectElement,
		value: string,
		text: string,
	): void {
		select.createEl('option', { value, text });
	}

	private renderStats(): void {
		const stats = this.contentEl.createDiv({ cls: 'cl-stats' });
		const all = this.plugin.index.getAll();

		for (const status of STATUSES) {
			const count = all.filter((item) => item.status === status.id).length;
			this.renderStatChip(stats, {
				text: `${status.label}: ${count}`,
				active: this.filterStatus === status.id,
				onClick: () => {
					this.filterStatus = status.id;
					this.render();
				},
			});
		}

		for (const schema of getAllTypeSchemas()) {
			const count = all.filter((item) => item.type === schema.id).length;
			this.renderStatChip(stats, {
				text: `${schema.label}: ${count}`,
				icon: schema.icon,
				active: this.filterType === schema.id,
				onClick: () => {
					this.filterType = schema.id;
					this.render();
				},
			});
		}

		const rated = all.filter((item) => item.rating !== null);
		if (rated.length > 0) {
			const average =
				rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) /
				rated.length;
			this.renderStatChip(stats, {
				text: `Средняя оценка: ${average.toFixed(1)} ★`,
				active: this.filterRating !== 'All',
				onClick: () => {
					this.filterRating = this.filterRating === 'All' ? '4' : 'All';
					this.render();
				},
			});
		}

		const year = new Date().getFullYear();
		const doneThisYear = all.filter((item) =>
			item.finished?.startsWith(String(year)),
		).length;
		this.renderStatChip(stats, {
			text: `Завершено за ${year}: ${doneThisYear}`,
			active: this.filterStatus === 'finished',
			onClick: () => {
				this.filterStatus = 'finished';
				this.render();
			},
		});
	}

	private renderStatChip(
		parent: HTMLElement,
		params: {
			text: string;
			icon?: string;
			active: boolean;
			onClick: () => void;
		},
	): void {
		const chip = parent.createDiv({ cls: 'cl-stat' });
		if (params.active) chip.addClass('is-active');
		if (params.icon) {
			setIcon(chip.createSpan({ cls: 'cl-stat-icon' }), params.icon);
		}
		chip.createSpan({ text: params.text });
		chip.addEventListener('click', params.onClick);
	}

	/** Столбчатый график «завершено по месяцам» за последние 12 месяцев. */
	private renderChart(): void {
		const all = this.plugin.index.getAll();
		const now = new Date();
		const months: { key: string; label: string; count: number }[] = [];
		for (let offset = 11; offset >= 0; offset--) {
			const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			months.push({
				key,
				label: MONTH_LABELS[date.getMonth()] ?? '',
				count: all.filter((item) => item.finished?.startsWith(key)).length,
			});
		}

		const wrap = this.contentEl.createDiv({ cls: 'cl-chart-wrap' });
		wrap.createDiv({ cls: 'cl-chart-title', text: 'Завершено по месяцам' });
		const chart = wrap.createDiv({ cls: 'cl-chart' });
		const max = Math.max(...months.map((month) => month.count), 1);
		for (const month of months) {
			const column = chart.createDiv({
				cls: 'cl-chart-col',
				attr: { title: `${month.key}: ${month.count}` },
			});
			const bar = column.createDiv({ cls: 'cl-chart-bar' });
			bar.style.height = `${Math.round((month.count / max) * 100)}%`;
			if (month.count === 0) bar.addClass('is-empty');
			column.createDiv({ cls: 'cl-chart-label', text: month.label });
		}
	}

	private renderList(): void {
		if (!this.listEl) return;
		const list = this.listEl;
		list.empty();
		list.removeClass('cl-list', 'cl-cards-grid');
		list.addClass(this.viewMode === 'Cards' ? 'cl-cards-grid' : 'cl-list');

		const items = this.filteredItems();
		if (items.length === 0) {
			const empty = list.createDiv({ cls: 'cl-empty' });
			empty.createEl('p', {
				text: 'Пока пусто. Добавьте книгу, фильм или игру — плагин сам создаст карточку и папку для заметок.',
			});
			const button = empty.createEl('button', {
				cls: 'mod-cta',
				text: 'Добавить контент',
			});
			button.addEventListener('click', () => {
				new AddContentModal(this.app, this.plugin).open();
			});
			return;
		}
		if (this.viewMode === 'Cards') {
			for (const item of items) {
				this.renderItemCard(list, item);
			}
		} else {
			for (const item of items) {
				this.renderItemRow(list, item);
			}
		}
	}

	private filteredItems(): ContentItem[] {
		let items = this.plugin.index.getAll();
		if (this.filterType !== 'All') {
			items = items.filter((item) => item.type === this.filterType);
		}
		if (this.filterStatus !== 'All') {
			items = items.filter((item) => item.status === this.filterStatus);
		}
		if (this.filterRating !== 'All') {
			const min = Number(this.filterRating);
			items = items.filter(
				(item) => item.rating !== null && item.rating >= min,
			);
		}
		const collator = new Intl.Collator('ru', { sensitivity: 'base' });
		switch (this.sortBy) {
			case 'Title':
				items.sort((a, b) => collator.compare(a.title, b.title));
				break;
			case 'Progress':
				items.sort(
					(a, b) => progressPercent(b) - progressPercent(a),
				);
				break;
			default:
				items.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
		}
		return items;
	}

	private renderItemRow(list: HTMLElement, item: ContentItem): void {
		const schema = getTypeSchema(item.type);
		if (!schema) return;
		const row = list.createDiv({ cls: 'cl-item' });
		row.addEventListener('click', () => {
			void this.app.workspace.getLeaf('tab').openFile(item.file);
		});

		const coverSrc = resolveCoverSrc(this.app, item);
		if (coverSrc) {
			row.createEl('img', {
				cls: 'cl-item-cover',
				attr: {
					src: coverSrc,
					alt: item.title,
					loading: 'lazy',
				},
			});
		} else {
			const icon = row.createDiv({ cls: 'cl-item-icon' });
			setIcon(icon, schema.icon);
		}

		const main = row.createDiv({ cls: 'cl-item-main' });
		main.createDiv({ cls: 'cl-item-title', text: item.title });
		const subtitle = schema.subtitleField
			? String(item.fields[schema.subtitleField] ?? '')
			: '';
		if (subtitle) {
			main.createDiv({ cls: 'cl-item-subtitle', text: subtitle });
		}
		appendSourceChip(this.plugin, main, item);
		if (item.description) {
			main.createDiv({
				cls: 'cl-item-desc',
				text: item.description,
				attr: { title: item.description },
			});
		}

		if (schema.progressField) {
			const progress = row.createDiv({ cls: 'cl-item-progress' });
			if (item.progress.total) {
				const bar = progress.createDiv({ cls: 'cl-progress' });
				const fill = bar.createDiv({ cls: 'cl-progress-fill' });
				fill.style.width = `${progressPercent(item)}%`;
			}
			progress.createDiv({
				cls: 'cl-item-progress-label',
				text: progressText(item),
			});
		}

		if (item.rating !== null) {
			row.createDiv({
				cls: 'cl-item-rating',
				text: '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating),
			});
		}

		row.createDiv({
			cls: `cl-status cl-status--${item.status}`,
			text: statusLabel(item.status),
		});
	}

	/** Большая карточка с превью обложки для режима «Карточки». */
	private renderItemCard(list: HTMLElement, item: ContentItem): void {
		const schema = getTypeSchema(item.type);
		if (!schema) return;
		const card = list.createDiv({ cls: 'cl-card-big' });
		card.addEventListener('click', () => {
			void this.app.workspace.getLeaf('tab').openFile(item.file);
		});

		const coverSrc = resolveCoverSrc(this.app, item);
		if (coverSrc) {
			card.createEl('img', {
				cls: 'cl-card-big-cover',
				attr: {
					src: coverSrc,
					alt: item.title,
					loading: 'lazy',
				},
			});
		} else {
			const placeholder = card.createDiv({
				cls: 'cl-card-big-cover cl-card-big-cover--empty',
			});
			setIcon(placeholder, schema.icon);
		}

		const body = card.createDiv({ cls: 'cl-card-big-body' });
		body.createDiv({ cls: 'cl-card-big-title', text: item.title });
		const subtitle = schema.subtitleField
			? String(item.fields[schema.subtitleField] ?? '')
			: '';
		if (subtitle) {
			body.createDiv({ cls: 'cl-card-big-subtitle', text: subtitle });
		}
		if (item.description) {
			body.createDiv({
				cls: 'cl-card-big-desc',
				text: item.description,
				attr: { title: item.description },
			});
		}

		if (schema.progressField) {
			const progress = body.createDiv({ cls: 'cl-card-big-progress' });
			if (item.progress.total) {
				const bar = progress.createDiv({ cls: 'cl-progress' });
				const fill = bar.createDiv({ cls: 'cl-progress-fill' });
				fill.style.width = `${progressPercent(item)}%`;
			}
			progress.createDiv({
				cls: 'cl-item-progress-label',
				text: progressText(item),
			});
		}

		const meta = body.createDiv({ cls: 'cl-card-big-meta' });
		appendSourceChip(this.plugin, meta, item);
		if (item.rating !== null) {
			meta.createDiv({
				cls: 'cl-item-rating',
				text: '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating),
			});
		}
		meta.createDiv({
			cls: `cl-status cl-status--${item.status}`,
			text: statusLabel(item.status),
		});
	}
}

export async function openDashboard(
	plugin: ContentLogPlugin,
): Promise<void> {
	const { workspace } = plugin.app;
	const existing = workspace.getLeavesOfType(VIEW_TYPE_CONTENT_DASHBOARD)[0];
	const leaf = existing ?? workspace.getLeaf('tab');
	await leaf.setViewState({
		type: VIEW_TYPE_CONTENT_DASHBOARD,
		active: true,
	});
	void workspace.revealLeaf(leaf);
}
