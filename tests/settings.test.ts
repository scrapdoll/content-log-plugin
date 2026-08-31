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
			tmdbSecretName: '  shared-tmdb  ',
		});

			expect(settings).toEqual({
			rootFolder: 'Library',
			sourceOpenMode: 'auto',
			sourceOpenByExtension: { epub: 'tab' },
			customTypes: [],
			metadataProviders: {
				selectedByKind: {},
				secretNames: { tmdb: 'shared-tmdb' },
			},
		});
	});

	it('normalizes generic provider selections and secret references', () => {
		const settings = normalizeSettings({
			metadataProviders: {
				selectedByKind: {
					movie: '  another-api ',
					series: ' series-api ',
					anime: ' anime-api ',
					book: 'ignored',
				},
				secretNames: {
					'another-api': ' shared-key ',
					empty: ' ',
				},
			},
		});
		expect(settings.metadataProviders).toEqual({
			selectedByKind: {
				movie: 'another-api',
				series: 'series-api',
				anime: 'anime-api',
			},
			secretNames: { 'another-api': 'shared-key' },
		});
	});
});
