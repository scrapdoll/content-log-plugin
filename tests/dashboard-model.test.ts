import { describe, expect, it } from 'vitest';
import {
	completionMonths,
	dashboardItemsSignature,
	selectDashboardItems,
} from '../src/ui/dashboard-model';
import type { ContentItem } from '../src/types';

function item(
	title: string,
	options: Partial<ContentItem> & { mtime: number },
): ContentItem {
	return {
		file: { stat: { mtime: options.mtime } } as ContentItem['file'],
		type: 'book',
		title,
		status: 'planned',
		fields: {},
		progress: { current: null, total: null },
		rating: null,
		cover: null,
		source: null,
		description: null,
		hltb: null,
		started: null,
		finished: null,
		...options,
	};
}

describe('dashboard model', () => {
	it('filters and sorts without mutating the index array', () => {
		const original = [
			item('Бета', { mtime: 1, rating: 3 }),
			item('Альфа', { mtime: 2, rating: 5 }),
		];

		const selected = selectDashboardItems(original, {
			type: 'All',
			status: 'All',
			minimumRating: 4,
			sort: 'Title',
		});

		expect(selected.map((value) => value.title)).toEqual(['Альфа']);
		expect(original.map((value) => value.title)).toEqual(['Бета', 'Альфа']);
	});

	it('filters by a custom status id', () => {
		const items = [
			item('На паузе', { mtime: 1, status: 'on-hold' }),
			item('Читаю', { mtime: 2, status: 'in-progress' }),
		];

		const selected = selectDashboardItems(items, {
			type: 'All',
			status: 'on-hold',
			minimumRating: 'All',
			sort: 'Title',
		});

		expect(selected.map((value) => value.title)).toEqual(['На паузе']);
	});

	it('uses path and mtime as the stable redraw signature', () => {
		const first = item('Один', { mtime: 1 });
		const second = item('Два', { mtime: 2 });
		first.file.path = 'Books/One.md';
		second.file.path = 'Books/Two.md';

		expect(dashboardItemsSignature([second, first])).toBe(
			'Books/One.md:1|Books/Two.md:2',
		);
	});

	it('aggregates completions once for the last twelve months', () => {
		const items = [
			item('Один', { mtime: 1, finished: '2026-08-01' }),
			item('Два', { mtime: 2, finished: '2026-08-17' }),
			item('Старый', { mtime: 3, finished: '2025-07-01' }),
		];

		const months = completionMonths(items, new Date(2026, 7, 19));

		expect(months).toHaveLength(12);
		expect(months.at(-1)).toEqual({ key: '2026-08', label: 'авг', count: 2 });
	});
});
