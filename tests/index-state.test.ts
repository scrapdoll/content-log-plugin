import { describe, expect, it } from 'vitest';
import {
	isContentCardPath,
	isInsideRoot,
	removeIndexedPath,
} from '../src/core/index-state';

describe('incremental index state', () => {
	it('matches only paths inside the configured root', () => {
		expect(isInsideRoot('Content Log', 'Content Log')).toBe(true);
		expect(isInsideRoot('Content Log', 'Content Log/Books/Dune.md')).toBe(true);
		expect(isInsideRoot('Content Log', 'Content Logger/Dune.md')).toBe(false);
	});

	it('excludes notes while accepting content cards', () => {
		expect(isContentCardPath('Content Log', 'Content Log/Books/Dune/Dune.md')).toBe(
			true,
		);
		expect(
			isContentCardPath(
				'Content Log',
				'Content Log/Books/Dune/Notes/2026-08-19.md',
			),
		).toBe(false);
		expect(isContentCardPath('Content Log', 'Content Log/Books/cover.jpg')).toBe(
			false,
		);
	});

	it('removes all indexed descendants of a deleted folder', () => {
		const items = new Map([
			['Content Log/Books/Dune/Dune.md', 'dune'],
			['Content Log/Books/Foundation/Foundation.md', 'foundation'],
			['Content Log/Games/Portal/Portal.md', 'portal'],
		]);

		expect(removeIndexedPath(items, 'Content Log/Books')).toBe(true);
		expect([...items.keys()]).toEqual(['Content Log/Games/Portal/Portal.md']);
	});
});
