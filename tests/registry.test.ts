import { describe, expect, it } from 'vitest';
import {
	getAllStatuses,
	getTypeSchema,
	rebuildTypeRegistry,
	statusesForType,
} from '../src/core/registry';
import { contentItemFromFrontmatter } from '../src/core/content-item';
import { TFile } from './obsidian';

const CUSTOM_STATUSES = [
	{ id: 'on-hold', label: 'На паузе', color: 'purple' },
	{ id: 'rewatching', label: 'Пересматриваю', color: null },
];

const BUILTIN_IDS = [
	'planned',
	'in-progress',
	'finished',
	'abandoned',
];

describe('type registry statuses', () => {
	it('appends per-type custom statuses to the built-in list', () => {
		rebuildTypeRegistry([], { anime: CUSTOM_STATUSES });

		expect(getTypeSchema('anime')?.statuses.map((s) => s.id)).toEqual([
			...BUILTIN_IDS,
			'on-hold',
			'rewatching',
		]);
		expect(getTypeSchema('book')?.statuses.map((s) => s.id)).toEqual(
			BUILTIN_IDS,
		);
	});

	it('drops damaged statuses, duplicates and built-in collisions', () => {
		rebuildTypeRegistry([], {
			book: [
				...CUSTOM_STATUSES,
				{ id: 'finished', label: 'Своё «завершено»', color: null },
				{ id: 'плохой ключ', label: 'Ключ', color: null },
				{ id: 'no-label', label: '', color: 'pink' },
				{ id: 'bad-color', label: 'Цвет', color: 'chartreuse' },
				{ id: 'on-hold', label: 'Дубль', color: null },
				'garbage',
			],
		});

		expect(getTypeSchema('book')?.statuses.map((s) => s.id)).toEqual([
			...BUILTIN_IDS,
			'on-hold',
			'rewatching',
		]);
	});

	it('unions statuses across types keeping the first label per id', () => {
		rebuildTypeRegistry([], {
			book: [{ id: 'on-hold', label: 'На паузе', color: 'purple' }],
			anime: [
				{ id: 'on-hold', label: 'На паузе (аниме)', color: null },
				{ id: 'season', label: 'Сезон', color: 'cyan' },
			],
		});

		const statuses = getAllStatuses();
		expect(statuses.map((s) => s.id)).toEqual([
			...BUILTIN_IDS,
			'on-hold',
			'season',
		]);
		expect(statuses.find((s) => s.id === 'on-hold')?.label).toBe('На паузе');
	});

	it('falls back to built-in statuses for unknown types', () => {
		rebuildTypeRegistry([], {});
		expect(statusesForType('unknown').map((s) => s.id)).toEqual(BUILTIN_IDS);
	});

	it('passes custom status ids through content items and defaults garbage to planned', () => {
		rebuildTypeRegistry([], { book: CUSTOM_STATUSES });
		const file = new TFile('Books/Dune.md') as never;

		const paused = contentItemFromFrontmatter(file, {
			type: 'book',
			status: 'on-hold',
		});
		const broken = contentItemFromFrontmatter(file, {
			type: 'book',
			status: 42,
		});

		expect(paused?.status).toBe('on-hold');
		expect(broken?.status).toBe('planned');
	});
});
