import { formatHours } from '../utils/format';
import type { ContentItem, ContentStatusId } from '../types';
import { progressPercent } from '../utils/helpers';

export type TypeFilter = string;
export type StatusFilter = ContentStatusId | 'All';
export type RatingFilter = 'All' | 1 | 2 | 3 | 4 | 5;
export type SortKey = 'Updated' | 'Title' | 'Progress';
export type ViewMode = 'List' | 'Cards';

export interface DashboardQuery {
	type: TypeFilter;
	status: StatusFilter;
	minimumRating: RatingFilter;
	sort: SortKey;
}

export interface CompletionMonth {
	key: string;
	label: string;
	count: number;
}

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

export function selectDashboardItems(
	allItems: ContentItem[],
	query: DashboardQuery,
): ContentItem[] {
	let items = [...allItems];
	if (query.type !== 'All') {
		items = items.filter((item) => item.type === query.type);
	}
	if (query.status !== 'All') {
		items = items.filter((item) => item.status === query.status);
	}
	if (query.minimumRating !== 'All') {
		const minimumRating = query.minimumRating;
		items = items.filter(
			(item) =>
				item.rating !== null && item.rating >= minimumRating,
		);
	}

	const collator = new Intl.Collator('ru', { sensitivity: 'base' });
	switch (query.sort) {
		case 'Title':
			items.sort((a, b) => collator.compare(a.title, b.title));
			break;
		case 'Progress':
			items.sort((a, b) => progressPercent(b) - progressPercent(a));
			break;
		case 'Updated':
			items.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
			break;
	}
	return items;
}

/** Сигнатура набора для пропуска лишней перерисовки dashboard. */
export function dashboardItemsSignature(items: ContentItem[]): string {
	return items
		.map((item) => `${item.file.path}:${item.file.stat.mtime}`)
		.sort()
		.join('|');
}

export function completionMonths(
	items: ContentItem[],
	now: Date,
): CompletionMonth[] {
	const counts = new Map<string, number>();
	for (const item of items) {
		const key = item.finished?.slice(0, 7);
		if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const months: CompletionMonth[] = [];
	for (let offset = 11; offset >= 0; offset--) {
		const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
		const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		months.push({
			key,
			label: MONTH_LABELS[date.getMonth()] ?? '',
			count: counts.get(key) ?? 0,
		});
	}
	return months;
}

export function hltbTimesText(item: ContentItem): string | null {
	if (!item.hltb) return null;
	const parts: string[] = [];
	if (item.hltb.main !== null) {
		parts.push(`Сюжет ${formatHours(item.hltb.main)}`);
	}
	if (item.hltb.extra !== null) {
		parts.push(`+ доп. ${formatHours(item.hltb.extra)}`);
	}
	if (item.hltb.complete !== null) {
		parts.push(`100% ${formatHours(item.hltb.complete)}`);
	}
	return parts.length > 0 ? parts.join(' · ') : null;
}
