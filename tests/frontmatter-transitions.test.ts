import { describe, expect, it } from 'vitest';
import {
	applyProgressChange,
	applyStatusChange,
} from '../src/core/frontmatter-transitions';

const TODAY = '2026-08-19';
const PROGRESS = {
	progressField: 'pages-read',
	progressTotalField: 'pages-total',
};

describe('frontmatter transitions', () => {
	it('uses the current frontmatter total instead of a stale item snapshot', () => {
		const fm: Record<string, unknown> = {
			status: 'in-progress',
			'pages-read': 50,
			'pages-total': 200,
			started: '2026-08-01',
		};

		const written = applyProgressChange(fm, PROGRESS, 150, TODAY);

		expect(written).toBe(150);
		expect(fm).toMatchObject({
			status: 'in-progress',
			'pages-read': 150,
			'pages-total': 200,
			started: '2026-08-01',
		});
	});

	it('finishes against the current total and maintains dates', () => {
		const fm: Record<string, unknown> = {
			status: 'planned',
			'pages-total': 120,
		};

		const written = applyProgressChange(fm, PROGRESS, 150, TODAY);

		expect(written).toBe(120);
		expect(fm).toMatchObject({
			status: 'finished',
			'pages-read': 120,
			started: TODAY,
			finished: TODAY,
		});
	});

	it('reopens a finished item when progress drops below its total', () => {
		const fm: Record<string, unknown> = {
			status: 'finished',
			'pages-read': 120,
			'pages-total': 120,
			started: '2026-08-01',
			finished: '2026-08-10',
		};

		applyProgressChange(fm, PROGRESS, 100, TODAY);

		expect(fm['status']).toBe('in-progress');
		expect(fm['started']).toBe('2026-08-01');
		expect(fm).not.toHaveProperty('finished');
	});

	it('removes a completion date when an item is abandoned', () => {
		const fm: Record<string, unknown> = {
			status: 'finished',
			started: '2026-08-01',
			finished: '2026-08-10',
		};

		applyStatusChange(fm, 'abandoned', TODAY);

		expect(fm).toEqual({
			status: 'abandoned',
			started: '2026-08-01',
		});
	});
});
