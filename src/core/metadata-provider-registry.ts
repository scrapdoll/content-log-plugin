import type {
	MediaMetadataKind,
	MediaMetadataProvider,
	MetadataProviderId,
} from './metadata-provider';

export class MetadataProviderRegistry {
	private readonly providers = new Map<
		MetadataProviderId,
		MediaMetadataProvider
	>();

	constructor(providers: Iterable<MediaMetadataProvider>) {
		for (const provider of providers) {
			if (this.providers.has(provider.info.id)) {
				throw new Error(`Duplicate metadata provider: ${provider.info.id}`);
			}
			this.providers.set(provider.info.id, provider);
		}
	}

	get(id: MetadataProviderId): MediaMetadataProvider | undefined {
		return this.providers.get(id);
	}

	getAll(): MediaMetadataProvider[] {
		return [...this.providers.values()];
	}

	getForKind(kind: MediaMetadataKind): MediaMetadataProvider[] {
		return this.getAll().filter((provider) =>
			provider.info.supportedKinds.includes(kind),
		);
	}

	resolve(
		kind: MediaMetadataKind,
		preferredId?: MetadataProviderId,
	): MediaMetadataProvider | null {
		const preferred = preferredId ? this.providers.get(preferredId) : undefined;
		if (preferred?.info.supportedKinds.includes(kind)) return preferred;
		return this.getForKind(kind)[0] ?? null;
	}
}
