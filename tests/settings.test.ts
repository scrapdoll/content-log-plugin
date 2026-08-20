import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/settings';

describe('normalizeSettings', () => {
	it('keeps only supported persisted values', () => {
		const settings = normalizeSettings({
			rootFolder: '  Library  ',
			sourceOpenMode: 'broken',
			sourceOpenByExtension: {
				epub: 'tab',
				mobi: 'broken',
				exe: 'system',
			},
			customTypes: [],
		});

		expect(settings).toEqual({
			rootFolder: 'Library',
			sourceOpenMode: 'auto',
			sourceOpenByExtension: { epub: 'tab' },
			customTypes: [],
		});
	});
});
