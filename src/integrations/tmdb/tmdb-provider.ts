import type {
	MediaMetadataDetails,
	MediaMetadataKind,
	MediaMetadataProvider,
	MediaMetadataSearchResult,
	MetadataProviderAttribution,
	MetadataProviderInfo,
} from '../../core/metadata-provider';
import {
	fetchTmdbDetailsRaw,
	searchTmdbRaw,
	type TmdbSearchType,
} from './tmdb-client';
import {
	normalizeTmdbDetailsResponse,
	normalizeTmdbSearchResponse,
	parseTmdbItemId,
} from './tmdb-normalize';

export class TmdbMetadataProvider implements MediaMetadataProvider {
	readonly info: MetadataProviderInfo;

	constructor(attribution: MetadataProviderAttribution | null) {
		this.info = {
			id: 'tmdb',
			label: 'TMDB',
			supportedKinds: ['movie', 'series', 'anime'],
			credential: {
				label: 'Ключ TMDB',
				description:
					'API key или токен доступа для чтения. В настройках сохраняется только имя секрета.',
				missingMessage:
					'Выберите секрет с ключом TMDB в настройках Content Log',
			},
			attribution,
		};
	}

	async search(
		query: string,
		kind: MediaMetadataKind,
		credential: string | null,
	): Promise<MediaMetadataSearchResult[]> {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) return [];
		const secret = requireCredential(credential);
		const searchType = searchTypeFor(kind);
		const response = await searchTmdbRaw(secret, normalizedQuery, searchType);
		return normalizeTmdbSearchResponse(response, searchType, kind);
	}

	async getDetails(
		result: MediaMetadataSearchResult,
		credential: string | null,
	): Promise<MediaMetadataDetails> {
		if (result.providerId !== this.info.id) {
			throw new Error('Результат принадлежит другому источнику');
		}
		const reference = parseTmdbItemId(result.itemId);
		if (!reference) throw new Error('Некорректный идентификатор TMDB');
		const response = await fetchTmdbDetailsRaw(
			requireCredential(credential),
			reference.mediaType,
			reference.id,
		);
		const details = normalizeTmdbDetailsResponse(
			response,
			reference.mediaType,
			result.kind,
		);
		if (!details) throw new Error('TMDB вернул неполные данные');
		return details;
	}
}

function searchTypeFor(kind: MediaMetadataKind): TmdbSearchType {
	if (kind === 'movie') return 'movie';
	if (kind === 'series') return 'tv';
	return 'multi';
}

function requireCredential(credential: string | null): string {
	if (!credential) throw new Error('Не настроен ключ TMDB');
	return credential;
}
