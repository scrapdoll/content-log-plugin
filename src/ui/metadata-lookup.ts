import { Notice } from 'obsidian';
import type { MediaMetadataDetails } from '../core/metadata-provider';
import { metadataKindForContent } from '../core/metadata-provider';
import { MetadataProviderConfigurationError } from '../core/metadata-service';
import type ContentLogPlugin from '../main';
import type { ContentItem } from '../types';
import { MetadataSearchModal } from './metadata-search-modal';

export function metadataProviderLabel(
	plugin: ContentLogPlugin,
	item: ContentItem,
): string | null {
	try {
		const context = lookupContext(plugin, item);
		return context?.provider.info.label ?? null;
	} catch (error) {
		if (error instanceof MetadataProviderConfigurationError) return null;
		throw error;
	}
}

export function openMetadataLookup(
	plugin: ContentLogPlugin,
	item: ContentItem,
	onPick: (details: MediaMetadataDetails) => void,
): boolean {
	try {
		const context = lookupContext(plugin, item);
		if (!context) return false;
		plugin.metadataService.credentialFor(
			context.provider,
			context.secretName,
		);
		new MetadataSearchModal(plugin.app, plugin.metadataService, {
			...context,
			initialQuery: item.title,
			onPick,
		}).open();
		return true;
	} catch (error) {
		if (error instanceof MetadataProviderConfigurationError) {
			new Notice(error.message);
			return false;
		}
		throw error;
	}
}

function lookupContext(plugin: ContentLogPlugin, item: ContentItem) {
	const kind = metadataKindForContent(item.type);
	if (!kind) return null;
	const provider = plugin.metadataService.resolveProvider(
		kind,
		plugin.settings.metadataProviders.selectedByKind[kind],
	);
	return {
		provider,
		kind,
		secretName:
			plugin.settings.metadataProviders.secretNames[provider.info.id],
	};
}
