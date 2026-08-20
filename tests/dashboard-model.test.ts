import { describe, expect, it } from 'vitest';
import {
	completionMonths,
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
			minimumRating: '4',
			sort: 'Title',
		});

		expect(selected.map((value) => value.title)).toEqual(['Альфа']);
		expect(original.map((value) => value.title)).toEqual(['Бета', 'Альфа']);
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
