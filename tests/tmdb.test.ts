import { describe, expect, it } from 'vitest';
import { metadataKindForContent } from '../src/core/metadata-provider';
import { buildTmdbRequest } from '../src/integrations/tmdb/tmdb-client';
import {
	normalizeTmdbDetailsResponse,
	normalizeTmdbSearchResponse,
} from '../src/integrations/tmdb/tmdb-normalize';

describe('TMDb normalization', () => {
	it('maps supported content types without exposing TMDB media types', () => {
		expect(metadataKindForContent('movie')).toBe('movie');
		expect(metadataKindForContent('series')).toBe('series');
		expect(metadataKindForContent('anime')).toBe('anime');
		expect(metadataKindForContent('book')).toBeNull();
	});

	it('keeps movies and TV shows from multi search and drops people', () => {
		const results = normalizeTmdbSearchResponse(
			{
				results: [
					{ id: 1, media_type: 'movie', title: 'Акира' },
					{ id: 2, media_type: 'tv', name: 'Монстр' },
					{ id: 3, media_type: 'person', name: 'Актёр' },
				],
			},
			'multi',
			'anime',
		);
		expect(results.map((result) => result.itemId)).toEqual([
			'movie:1',
			'tv:2',
		]);
	});

	it('uses query authentication for v3 keys and bearer authentication for tokens', () => {
		const key = '0123456789abcdef0123456789abcdef';
		const keyRequest = buildTmdbRequest('/search/movie', { query: 'Dune' }, key);
		expect(keyRequest.url).toContain(`api_key=${key}`);
		expect(keyRequest.headers).not.toHaveProperty('Authorization');

		const tokenRequest = buildTmdbRequest(
			'/search/tv',
			{ query: 'Dark' },
			'eyJhbGciOiJIUzI1NiJ9.token',
		);
		expect(tokenRequest.url).not.toContain('eyJ');
		expect(tokenRequest.headers).toMatchObject({
			Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.token',
		});
	});

	it('normalizes movie search results and skips malformed entries', () => {
		const results = normalizeTmdbSearchResponse(
			{
				results: [
					{
						id: 157336,
						title: 'Интерстеллар',
						original_title: 'Interstellar',
						release_date: '2014-11-05',
						poster_path: '/poster.jpg',
						vote_average: 8.46,
						overview: 'Космическая экспедиция.',
					},
					{ id: null, title: '' },
				],
			},
			'movie',
			'movie',
		);

		expect(results).toEqual([
			{
				providerId: 'tmdb',
				itemId: 'movie:157336',
				kind: 'movie',
				title: 'Интерстеллар',
				originalTitle: 'Interstellar',
				year: 2014,
				overview: 'Космическая экспедиция.',
				posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
				rating: 8.5,
			},
		]);
	});

	it('normalizes TV details used by series and anime cards', () => {
		const details = normalizeTmdbDetailsResponse(
			{
				id: 70523,
				name: 'Тьма',
				original_name: 'Dark',
				first_air_date: '2017-12-01',
				poster_path: '/dark.jpg',
				vote_average: 8.4,
				overview: 'Исчезновение ребёнка раскрывает тайны города.',
				created_by: [{ name: 'Баран бо Одар' }, { name: 'Баран бо Одар' }],
				production_companies: [{ name: 'Wiedemann & Berg' }],
				episode_run_time: [53],
				number_of_seasons: 3,
				number_of_episodes: 26,
				genres: [{ name: 'Драма' }, { name: 'Детектив' }],
				credits: { crew: [] },
			},
			'tv',
			'series',
		);

		expect(details).toMatchObject({
			itemId: 'tv:70523',
			creator: 'Баран бо Одар',
			studio: 'Wiedemann & Berg',
			runtimeMinutes: 53,
			seasonsTotal: 3,
			episodesTotal: 26,
			genres: 'Драма, Детектив',
			providerUrl: 'https://www.themoviedb.org/tv/70523',
		});
	});

	it('extracts movie directors from appended credits', () => {
		const details = normalizeTmdbDetailsResponse(
			{
				id: 157336,
				title: 'Интерстеллар',
				original_title: 'Interstellar',
				release_date: '2014-11-05',
				runtime: 169,
				genres: [],
				credits: {
					crew: [
						{ name: 'Кристофер Нолан', job: 'Director' },
						{ name: 'Другой человек', job: 'Producer' },
					],
				},
			},
			'movie',
			'movie',
		);

		expect(details?.director).toBe('Кристофер Нолан');
		expect(details?.runtimeMinutes).toBe(169);
	});
});
