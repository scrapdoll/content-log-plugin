import { describe, expect, it } from 'vitest';
import type {
	MediaMetadataKind,
	MediaMetadataProvider,
} from '../src/core/metadata-provider';
import { MetadataProviderRegistry } from '../src/core/metadata-provider-registry';
import {
	MetadataProviderConfigurationError,
	MetadataService,
} from '../src/core/metadata-service';
import { contentItemFromFrontmatter } from '../src/core/content-item';
import { rebuildTypeRegistry } from '../src/core/registry';
import { TFile } from './obsidian';

function fakeProvider(
	id: string,
	kinds: MediaMetadataKind[],
	requiresCredential = false,
): MediaMetadataProvider {
	return {
		info: {
			id,
			label: id.toUpperCase(),
			supportedKinds: kinds,
			credential: requiresCredential
				? {
					label: 'Ключ',
					description: 'Секрет',
					missingMessage: `Нет ключа ${id}`,
				}
				: null,
			attribution: null,
		},
		search: async (query, kind, credential) => [
			{
				providerId: id,
				itemId: `${id}:1`,
				kind,
				title: `${query}:${credential ?? 'public'}`,
				originalTitle: query,
				year: null,
				overview: '',
				posterUrl: null,
				rating: null,
			},
		],
		getDetails: async (result) =>
			({
				...result,
				director: '',
				creator: '',
				studio: '',
				runtimeMinutes: null,
				seasonsTotal: null,
				episodesTotal: null,
				genres: '',
				providerUrl: '',
			}),
	};
}

describe('metadata provider boundary', () => {
	it('reads legacy TMDB fields through provider-neutral schema keys', () => {
		rebuildTypeRegistry([]);
		const item = contentItemFromFrontmatter(new TFile('Movies/Dune.md') as never, {
			type: 'movie',
			title: 'Дюна',
			'tmdb-id': 438631,
			'tmdb-rating': 8.1,
		});
		expect(item?.fields).toMatchObject({
			'metadata-id': 438631,
			'metadata-rating': 8.1,
		});
	});

	it('selects a configured implementation and falls back by supported kind', () => {
		const first = fakeProvider('first', ['movie']);
		const second = fakeProvider('second', ['movie', 'series']);
		const registry = new MetadataProviderRegistry([first, second]);

		expect(registry.resolve('movie', 'second')).toBe(second);
		expect(registry.resolve('movie', 'missing')).toBe(first);
		expect(registry.resolve('series', 'first')).toBe(second);
		expect(registry.resolve('anime')).toBeNull();
	});

	it('resolves secrets outside the provider and passes only the value', async () => {
		const provider = fakeProvider('secure', ['movie'], true);
		const service = new MetadataService(
			new MetadataProviderRegistry([provider]),
			(name) => (name === 'shared-secret' ? '  actual-key  ' : null),
		);

		const results = await service.search(
			'movie',
			'secure',
			'shared-secret',
			'Dune',
		);
		expect(results[0]?.title).toBe('Dune:actual-key');
	});

	it('reports a provider-specific configuration error before transport', async () => {
		const provider = fakeProvider('secure', ['movie'], true);
		const service = new MetadataService(
			new MetadataProviderRegistry([provider]),
			() => null,
		);

		await expect(
			service.search('movie', 'secure', undefined, 'Dune'),
		).rejects.toEqual(
			expect.objectContaining<Partial<MetadataProviderConfigurationError>>({
				message: 'Нет ключа secure',
			}),
		);
	});
});
