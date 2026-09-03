import { ItemView, WorkspaceLeaf } from 'obsidian';
import type ContentLogPlugin from '../main';
import { exportDashboardMarkdown } from '../commands/export';
import { getAllTypeSchemas } from '../core/registry';
import { AddContentModal } from './add-content-modal';
import {
	dashboardItemsSignature,
	selectDashboardItems,
	type RatingFilter,
	type SortKey,
	type StatusFilter,
	type ViewMode,
} from './dashboard-model';
import {
	renderDashboardItemCard,
	renderDashboardItemRow,
} from './dashboard-items';
import {
	renderDashboardChart,
	renderDashboardStats,
} from './dashboard-summary';
import {
	renderDashboardControls,
	setStatusSelectOptions,
	setTypeSelectOptions,
	statusesForFilter,
} from './dashboard-controls';

export const VIEW_TYPE_CONTENT_DASHBOARD = 'content-log-dashboard';

/** Живой дашборд со всем контентом: статистика, график, фильтры, обложки. */
export class ContentDashboardView extends ItemView {
	private filterTypes: string[] = [];
	private filterStatus: StatusFilter = 'All';
	private filterRating: RatingFilter = 'All';
	private sortBy: SortKey = 'Updated';
	private viewMode: ViewMode = 'List';
	private statsEl: HTMLElement | null = null;
	private chartEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private typeSelect: HTMLSelectElement | null = null;
	private statusSelect: HTMLSelectElement | null = null;
	private ratingSelect: HTMLSelectElement | null = null;
	private listButton: HTMLButtonElement | null = null;
	private cardsButton: HTMLButtonElement | null = null;
	private lastItemsSignature = '';
	private lastSchemasSignature = '';

	private readonly changeHandler = () => this.refreshFromIndex();

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
		this.statsEl = contentEl.createDiv({ cls: 'cl-stats' });
		this.chartEl = contentEl.createDiv({ cls: 'cl-chart-wrap' });
		this.listEl = contentEl.createDiv({ cls: 'cl-list' });
		this.captureIndexSignatures();
		this.renderStats();
		this.renderChart();
		this.renderList();
	}

	private renderHeader(): void {
		const controls = renderDashboardControls(
			this.contentEl,
			{
				types: this.filterTypes,
				status: this.filterStatus,
				rating: this.filterRating,
				sort: this.sortBy,
				view: this.viewMode,
			},
			{
				onAdd: () => new AddContentModal(this.app, this.plugin).open(),
				onExport: () => void exportDashboardMarkdown(this.plugin),
				onTypes: (value) => this.setFilters({ types: value }),
				onStatus: (value) => this.setFilters({ status: value }),
				onRating: (value) => this.setFilters({ rating: value }),
				onSort: (value) => {
					this.sortBy = value;
					this.renderList();
				},
				onView: (value) => {
					this.viewMode = value;
					this.syncHeader();
					this.renderList();
				},
			},
		);
		this.typeSelect = controls.typeSelect;
		this.statusSelect = controls.statusSelect;
		this.ratingSelect = controls.ratingSelect;
		this.listButton = controls.listButton;
		this.cardsButton = controls.cardsButton;
	}

	private renderStats(): void {
		const stats = this.statsEl;
		if (!stats) return;
		renderDashboardStats(
			stats,
			this.plugin.index.getAll(),
			{
				types: this.filterTypes,
				status: this.filterStatus,
				rating: this.filterRating,
			},
			{
				onTypeToggle: (id) => this.toggleType(id),
				onStatus: (value) => this.setFilters({ status: value }),
				onRating: (value) => this.setFilters({ rating: value }),
			},
		);
	}

	private toggleType(id: string): void {
		this.setFilters({
			types: this.filterTypes.includes(id)
				? this.filterTypes.filter((type) => type !== id)
				: [...this.filterTypes, id],
		});
	}

	private setFilters(values: {
		types?: string[];
		status?: StatusFilter;
		rating?: RatingFilter;
	}): void {
		if (values.types !== undefined) this.filterTypes = values.types;
		if (values.status !== undefined) this.filterStatus = values.status;
		if (values.rating !== undefined) this.filterRating = values.rating;
		this.syncHeader();
		this.renderStats();
		this.renderList();
	}

	private renderChart(): void {
		if (!this.chartEl) return;
		renderDashboardChart(
			this.chartEl,
			this.plugin.index.getAll(),
			new Date(),
		);
	}

	private refreshFromIndex(): void {
		const itemsSignature = dashboardItemsSignature(this.plugin.index.getAll());
		const schemasSignature = this.schemasSignature();
		if (
			itemsSignature === this.lastItemsSignature &&
			schemasSignature === this.lastSchemasSignature
		) {
			return;
		}
		if (schemasSignature !== this.lastSchemasSignature) {
			this.render();
			return;
		}
		this.lastItemsSignature = itemsSignature;
		this.renderStats();
		this.renderChart();
		this.renderList();
	}

	private captureIndexSignatures(): void {
		this.lastItemsSignature = dashboardItemsSignature(this.plugin.index.getAll());
		this.lastSchemasSignature = this.schemasSignature();
	}

	private schemasSignature(): string {
		return getAllTypeSchemas()
			.map(
				(schema) =>
					`${schema.id}:${schema.label}:${schema.icon}:${schema.statuses
						.map((s) => `${s.id}/${s.label}/${s.color ?? ''}`)
						.join(',')}`,
			)
			.join('|');
	}

	private syncHeader(): void {
		if (this.typeSelect) {
			setTypeSelectOptions(this.typeSelect, this.filterTypes);
		}
		if (this.statusSelect) {
			// Набор статусов зависит от выбранных типов: при смене типов фильтр
			// статусов пересобирается, а недействующий выбор сбрасывается.
			this.filterStatus = setStatusSelectOptions(
				this.statusSelect,
				statusesForFilter(this.filterTypes),
				this.filterStatus,
			);
		}
		if (this.ratingSelect) {
			this.ratingSelect.value = String(this.filterRating);
		}
		this.listButton?.toggleClass('is-active', this.viewMode === 'List');
		this.cardsButton?.toggleClass('is-active', this.viewMode === 'Cards');
	}

	private renderList(): void {
		if (!this.listEl) return;
		const list = this.listEl;
		list.empty();
		list.removeClass('cl-list', 'cl-cards-grid');
		list.addClass(this.viewMode === 'Cards' ? 'cl-cards-grid' : 'cl-list');

		const items = selectDashboardItems(this.plugin.index.getAll(), {
			types: this.filterTypes,
			status: this.filterStatus,
			minimumRating: this.filterRating,
			sort: this.sortBy,
		});
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
				renderDashboardItemCard(this.plugin, list, item);
			}
		} else {
			for (const item of items) {
				renderDashboardItemRow(this.plugin, list, item);
			}
		}
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
