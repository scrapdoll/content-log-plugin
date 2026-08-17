import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';
import type ContentLogPlugin from '../main';
import { exportDashboardMarkdown } from '../commands/export';
import { getAllTypeSchemas, getTypeSchema } from '../core/registry';
import {
	STATUSES,
	type ContentItem,
	type ContentStatus,
	statusLabel,
} from '../types';
import { progressPercent, progressText } from '../utils/helpers';
import { AddContentModal } from './add-content-modal';

export const VIEW_TYPE_CONTENT_DASHBOARD = 'content-log-dashboard';

/** 'All' либо id типа контента. */
type TypeFilter = string;
type StatusFilter = ContentStatus | 'All';
type SortKey = 'Updated' | 'Title' | 'Progress';

/** Живой дашборд со всем контентом: статистика, фильтры, сортировка, прогресс. */
export class ContentDashboardView extends ItemView {
	private filterType: TypeFilter = 'All';
	private filterStatus: StatusFilter = 'All';
	private sortBy: SortKey = 'Updated';
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

		const sortSelect = header.createEl('select');
		this.addOption(sortSelect, 'Updated', 'По обновлению');
		this.addOption(sortSelect, 'Title', 'По названию');
		this.addOption(sortSelect, 'Progress', 'По прогрессу');
		sortSelect.value = this.sortBy;
		sortSelect.addEventListener('change', () => {
			this.sortBy = sortSelect.value as SortKey;
			this.renderList();
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

	private renderList(): void {
		if (!this.listEl) return;
		const list = this.listEl;
		list.empty();

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
		for (const item of items) {
			this.renderItemRow(list, item);
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

		const icon = row.createDiv({ cls: 'cl-item-icon' });
		setIcon(icon, schema.icon);

		const main = row.createDiv({ cls: 'cl-item-main' });
		main.createDiv({ cls: 'cl-item-title', text: item.title });
		const subtitle = schema.subtitleField
			? String(item.fields[schema.subtitleField] ?? '')
			: '';
		if (subtitle) {
			main.createDiv({ cls: 'cl-item-subtitle', text: subtitle });
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

		row.createDiv({
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
