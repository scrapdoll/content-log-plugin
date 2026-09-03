import { setIcon } from 'obsidian';
import { getAllTypeSchemas } from '../core/registry';
import type { ContentItem } from '../types';
import { statusesForFilter } from './dashboard-controls';
import {
	completionMonths,
	type RatingFilter,
	type StatusFilter,
} from './dashboard-model';

interface DashboardFilterState {
	types: string[];
	status: StatusFilter;
	rating: RatingFilter;
}

interface DashboardFilterCallbacks {
	/** Клик по чипу типа: добавить в выборку или убрать из неё. */
	onTypeToggle: (id: string) => void;
	onStatus: (value: StatusFilter) => void;
	onRating: (value: RatingFilter) => void;
}

export function renderDashboardStats(
	parent: HTMLElement,
	items: ContentItem[],
	state: DashboardFilterState,
	callbacks: DashboardFilterCallbacks,
): void {
	parent.empty();
	// Чипы статусов — по выбранным типам (пустой выбор — встроенные).
	for (const status of statusesForFilter(state.types)) {
		renderStatChip(parent, {
			text: `${status.label}: ${items.filter((item) => item.status === status.id).length}`,
			active: state.status === status.id,
			onClick: () => callbacks.onStatus(status.id),
		});
	}
	for (const schema of getAllTypeSchemas()) {
		renderStatChip(parent, {
			text: `${schema.label}: ${items.filter((item) => item.type === schema.id).length}`,
			icon: schema.icon,
			active: state.types.includes(schema.id),
			onClick: () => callbacks.onTypeToggle(schema.id),
		});
	}
	const rated = items.filter((item) => item.rating !== null);
	if (rated.length > 0) {
		const average =
			rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) /
			rated.length;
		renderStatChip(parent, {
			text: `Средняя оценка: ${average.toFixed(1)} ★`,
			active: state.rating !== 'All',
			onClick: () => callbacks.onRating(state.rating === 'All' ? 4 : 'All'),
		});
	}
	const year = new Date().getFullYear();
	const doneThisYear = items.filter((item) =>
		item.finished?.startsWith(String(year)),
	).length;
	renderStatChip(parent, {
		text: `Завершено за ${year}: ${doneThisYear}`,
		active: state.status === 'finished',
		onClick: () => callbacks.onStatus('finished'),
	});
}

export function renderDashboardChart(
	parent: HTMLElement,
	items: ContentItem[],
	now = new Date(),
): void {
	parent.empty();
	const months = completionMonths(items, now);
	parent.createDiv({ cls: 'cl-chart-title', text: 'Завершено по месяцам' });
	const chart = parent.createDiv({ cls: 'cl-chart' });
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

function renderStatChip(
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
