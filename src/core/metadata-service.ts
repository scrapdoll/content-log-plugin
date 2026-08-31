import type {
	MediaMetadataDetails,
	MediaMetadataKind,
	MediaMetadataProvider,
	MediaMetadataSearchResult,
	MetadataProviderId,
} from './metadata-provider';
import { MetadataProviderRegistry } from './metadata-provider-registry';

export type SecretResolver = (secretName: string) => string | null;

export class MetadataProviderConfigurationError extends Error {}

export class MetadataService {
	constructor(
		readonly registry: MetadataProviderRegistry,
		private readonly resolveSecret: SecretResolver,
	) {}

	resolveProvider(
		kind: MediaMetadataKind,
		preferredId?: MetadataProviderId,
	): MediaMetadataProvider {
		const provider = this.registry.resolve(kind, preferredId);
		if (!provider) {
			throw new MetadataProviderConfigurationError(
				'Для этого типа контента нет доступного источника метаданных',
			);
		}
		return provider;
	}

	async search(
		kind: MediaMetadataKind,
		preferredId: MetadataProviderId | undefined,
		secretName: string | undefined,
		query: string,
	): Promise<MediaMetadataSearchResult[]> {
		const provider = this.resolveProvider(kind, preferredId);
		return provider.search(
			query,
			kind,
			this.credentialFor(provider, secretName),
		);
	}

	async getDetails(
		result: MediaMetadataSearchResult,
		secretName: string | undefined,
	): Promise<MediaMetadataDetails> {
		const provider = this.registry.get(result.providerId);
		if (!provider || !provider.info.supportedKinds.includes(result.kind)) {
			throw new MetadataProviderConfigurationError(
				'Источник результата больше не доступен',
			);
		}
		return provider.getDetails(
			result,
			this.credentialFor(provider, secretName),
		);
	}

	credentialFor(
		provider: MediaMetadataProvider,
		secretName: string | undefined,
	): string | null {
		if (!provider.info.credential) return null;
		const credential = secretName
			? this.resolveSecret(secretName)?.trim()
			: null;
		if (!credential) {
			throw new MetadataProviderConfigurationError(
				provider.info.credential.missingMessage,
			);
		}
		return credential;
	}
}
