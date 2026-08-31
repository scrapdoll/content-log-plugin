export type MediaMetadataKind = 'movie' | 'series' | 'anime';

export type MetadataProviderId = string;

export interface MediaMetadataSearchResult {
	providerId: MetadataProviderId;
	/** Непрозрачный идентификатор результата внутри конкретного провайдера. */
	itemId: string;
	kind: MediaMetadataKind;
	title: string;
	originalTitle: string;
	year: number | null;
	overview: string;
	posterUrl: string | null;
	rating: number | null;
}

export interface MediaMetadataDetails extends MediaMetadataSearchResult {
	director: string;
	creator: string;
	studio: string;
	runtimeMinutes: number | null;
	seasonsTotal: number | null;
	episodesTotal: number | null;
	genres: string;
	providerUrl: string;
}

export interface MetadataProviderCredentialInfo {
	label: string;
	description: string;
	missingMessage: string;
}

export interface MetadataProviderAttribution {
	logoDataUrl: string;
	logoAlt: string;
	notice: string;
	url: string;
}

export interface MetadataProviderInfo {
	id: MetadataProviderId;
	label: string;
	supportedKinds: readonly MediaMetadataKind[];
	credential: MetadataProviderCredentialInfo | null;
	attribution: MetadataProviderAttribution | null;
}

/** Порт внешнего каталога. UI и use-case работают только с этим контрактом. */
export interface MediaMetadataProvider {
	readonly info: MetadataProviderInfo;
	search(
		query: string,
		kind: MediaMetadataKind,
		credential: string | null,
	): Promise<MediaMetadataSearchResult[]>;
	getDetails(
		result: MediaMetadataSearchResult,
		credential: string | null,
	): Promise<MediaMetadataDetails>;
}

export interface MetadataProviderSettings {
	selectedByKind: Partial<Record<MediaMetadataKind, MetadataProviderId>>;
	secretNames: Record<MetadataProviderId, string>;
}

export function metadataKindForContent(type: string): MediaMetadataKind | null {
	if (type === 'movie' || type === 'series' || type === 'anime') return type;
	return null;
}
