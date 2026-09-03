import { setIcon } from 'obsidian';
import {
	getAllStatuses,
	getAllTypeSchemas,
	statusesForType,
} from '../core/registry';
import type { StatusDef } from '../types';
import type {
	RatingFilter,
	SortKey,
	StatusFilter,
	TypeFilter,
	ViewMode,
} from './dashboard-model';

export interface DashboardControlsState {
	type: TypeFilter;
	status: StatusFilter;
	rating: RatingFilter;
	sort: SortKey;
	view: ViewMode;
}

export interface DashboardControlsCallbacks {
	onAdd: () => void;
	onExport: () => void;
	onType: (value: TypeFilter) => void;
	onStatus: (value: StatusFilter) => void;
	onRating: (value: RatingFilter) => void;
	onSort: (value: SortKey) => void;
	onView: (value: ViewMode) => void;
}

export interface DashboardControlElements {
	typeSelect: HTMLSelectElement;
	statusSelect: HTMLSelectElement;
	ratingSelect: HTMLSelectElement;
	listButton: HTMLButtonElement;
	cardsButton: HTMLButtonElement;
}

export function renderDashboardControls(
	parent: HTMLElement,
	state: DashboardControlsState,
	callbacks: DashboardControlsCallbacks,
): DashboardControlElements {
	const header = parent.createDiv({ cls: 'cl-header' });
	header
		.createEl('button', { cls: 'mod-cta', text: '+ Добавить' })
		.addEventListener('click', callbacks.onAdd);
	header
		.createEl('button', { text: 'Экспорт .md' })
		.addEventListener('click', callbacks.onExport);

	const typeSelect = header.createEl('select');
	addOption(typeSelect, 'All', 'Все типы');
	for (const schema of getAllTypeSchemas()) {
		addOption(typeSelect, schema.id, schema.label);
	}
	typeSelect.value = state.type;
	typeSelect.addEventListener('change', () => callbacks.onType(typeSelect.value));

	const statusSelect = header.createEl('select');
	setStatusSelectOptions(
		statusSelect,
		statusesForFilter(state.type),
		state.status,
	);
	statusSelect.addEventListener('change', () =>
		callbacks.onStatus(statusSelect.value === 'All' ? 'All' : statusSelect.value),
	);

	const ratingSelect = header.createEl('select');
	addOption(ratingSelect, 'All', 'Любая оценка');
	for (let star = 1; star <= 5; star++) {
		addOption(ratingSelect, String(star), `${'★'.repeat(star)} и выше`);
	}
	ratingSelect.value = String(state.rating);
	ratingSelect.addEventListener('change', () =>
		callbacks.onRating(ratingFilterFrom(ratingSelect.value)),
	);

	const sortSelect = header.createEl('select');
	addOption(sortSelect, 'Updated', 'По обновлению');
	addOption(sortSelect, 'Title', 'По названию');
	addOption(sortSelect, 'Progress', 'По прогрессу');
	sortSelect.value = state.sort;
	sortSelect.addEventListener('change', () =>
		callbacks.onSort(sortSelect.value as SortKey),
	);

	const toggle = header.createDiv({ cls: 'cl-view-toggle' });
	const listButton = toggle.createEl('button', {
		cls: `cl-view-toggle-button${state.view === 'List' ? ' is-active' : ''}`,
		attr: { 'aria-label': 'Список' },
	});
	setIcon(listButton, 'list');
	const cardsButton = toggle.createEl('button', {
		cls: `cl-view-toggle-button${state.view === 'Cards' ? ' is-active' : ''}`,
		attr: { 'aria-label': 'Карточки' },
	});
	setIcon(cardsButton, 'layout-grid');
	listButton.addEventListener('click', () => callbacks.onView('List'));
	cardsButton.addEventListener('click', () => callbacks.onView('Cards'));

	return { typeSelect, statusSelect, ratingSelect, listButton, cardsButton };
}

/** Статусы для фильтра: список выбранного типа или объединение всех типов. */
export function statusesForFilter(type: TypeFilter): StatusDef[] {
	return type === 'All' ? getAllStatuses() : statusesForType(type);
}

/**
 * Пересобирает опции фильтра статусов. Если текущий фильтр ссылается на
 * статус, которого нет в новом списке, сбрасывает на «Все» и возвращает
 * действующее значение.
 */
export function setStatusSelectOptions(
	select: HTMLSelectElement,
	statuses: StatusDef[],
	selected: StatusFilter,
): StatusFilter {
	select.empty();
	addOption(select, 'All', 'Все статусы');
	for (const status of statuses) addOption(select, status.id, status.label);
	const effective =
		selected !== 'All' && statuses.some((s) => s.id === selected)
			? selected
			: 'All';
	select.value = effective;
	return effective;
}

function addOption(
	select: HTMLSelectElement,
	value: string,
	text: string,
): void {
	select.createEl('option', { value, text });
}

function ratingFilterFrom(value: string): RatingFilter {
	if (value === 'All') return 'All';
	const rating = Number(value);
	return rating >= 1 && rating <= 5 && Number.isInteger(rating)
		? (rating as RatingFilter)
		: 'All';
}
