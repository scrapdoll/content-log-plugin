import type {
	MediaMetadataDetails,
	MediaMetadataKind,
	MediaMetadataSearchResult,
} from '../../core/metadata-provider';
import { finiteNumberOrNull, isRecord } from '../../utils/guards';
import type { TmdbMediaType, TmdbSearchType } from './tmdb-client';

const PROVIDER_ID = 'tmdb';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const SITE_BASE_URL = 'https://www.themoviedb.org';

export function normalizeTmdbSearchResponse(
	value: unknown,
	searchType: TmdbSearchType,
	kind: MediaMetadataKind,
): MediaMetadataSearchResult[] {
	if (!isRecord(value) || !Array.isArray(value['results'])) return [];
	return value['results']
		.map((candidate) => {
			const mediaType =
				searchType === 'multi' && isRecord(candidate)
					? candidate['media_type']
					: searchType;
			return mediaType === 'movie' || mediaType === 'tv'
				? searchResultFrom(candidate, mediaType, kind)
				: null;
		})
		.filter(
			(result): result is MediaMetadataSearchResult => result !== null,
		);
}

export function normalizeTmdbDetailsResponse(
	value: unknown,
	mediaType: TmdbMediaType,
	kind: MediaMetadataKind,
): MediaMetadataDetails | null {
	const base = searchResultFrom(value, mediaType, kind);
	if (!base || !isRecord(value)) return null;
	const credits = isRecord(value['credits']) ? value['credits'] : {};
	const crew = Array.isArray(credits['crew']) ? credits['crew'] : [];
	const director = uniqueNames(
		crew.filter(
			(member) => isRecord(member) && member['job'] === 'Director',
		),
	);
	const creator = uniqueNames(
		Array.isArray(value['created_by']) ? value['created_by'] : [],
	);
	const studio = uniqueNames(
		Array.isArray(value['production_companies'])
			? value['production_companies']
			: [],
	);
	const runtime =
		mediaType === 'movie'
			? positiveNumber(value['runtime'])
			: firstPositiveNumber(value['episode_run_time']);
	const genres = (Array.isArray(value['genres']) ? value['genres'] : [])
		.map((genre) => (isRecord(genre) ? stringValue(genre['name']) : ''))
		.filter(Boolean)
		.join(', ');

	return {
		...base,
		director,
		creator,
		studio,
		runtimeMinutes: runtime,
		seasonsTotal: positiveNumber(value['number_of_seasons']),
		episodesTotal: positiveNumber(value['number_of_episodes']),
		genres,
		providerUrl: `${SITE_BASE_URL}/${mediaType}/${numericId(base.itemId)}`,
	};
}

export function parseTmdbItemId(
	itemId: string,
): { mediaType: TmdbMediaType; id: number } | null {
	const match = /^(movie|tv):(\d+)$/.exec(itemId);
	if (!match) return null;
	return {
		mediaType: match[1] as TmdbMediaType,
		id: Number(match[2]),
	};
}

function searchResultFrom(
	value: unknown,
	mediaType: TmdbMediaType,
	kind: MediaMetadataKind,
): MediaMetadataSearchResult | null {
	if (!isRecord(value)) return null;
	const id = finiteNumberOrNull(value['id']);
	const title = stringValue(
		mediaType === 'movie' ? value['title'] : value['name'],
	);
	if (id === null || !title) return null;
	const originalTitle = stringValue(
		mediaType === 'movie'
			? value['original_title']
			: value['original_name'],
	);
	const date = stringValue(
		mediaType === 'movie'
			? value['release_date']
			: value['first_air_date'],
	);
	const posterPath = stringValue(value['poster_path']);
	const rating = finiteNumberOrNull(value['vote_average']);
	return {
		providerId: PROVIDER_ID,
		itemId: `${mediaType}:${id}`,
		kind,
		title,
		originalTitle: originalTitle || title,
		year: yearFromDate(date),
		overview: stringValue(value['overview']),
		posterUrl: posterPath
			? `${IMAGE_BASE_URL}/${posterPath.replace(/^\/+/, '')}`
			: null,
		rating:
			rating !== null && rating > 0 ? Math.round(rating * 10) / 10 : null,
	};
}

function numericId(itemId: string): number {
	return parseTmdbItemId(itemId)?.id ?? 0;
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function positiveNumber(value: unknown): number | null {
	const number = finiteNumberOrNull(value);
	return number !== null && number > 0 ? number : null;
}

function firstPositiveNumber(value: unknown): number | null {
	if (!Array.isArray(value)) return null;
	for (const candidate of value) {
		const number = positiveNumber(candidate);
		if (number !== null) return number;
	}
	return null;
}

function uniqueNames(values: unknown[]): string {
	const names = values
		.map((value) => (isRecord(value) ? stringValue(value['name']) : ''))
		.filter(Boolean);
	return [...new Set(names)].join(', ');
}

function yearFromDate(value: string): number | null {
	const match = /^(\d{4})-/.exec(value);
	return match ? Number(match[1]) : null;
}
