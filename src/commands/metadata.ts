import { Notice } from 'obsidian';
import { metadataKindForContent } from '../core/metadata-provider';
import { writeMediaMetadata } from '../core/mutations';
import type ContentLogPlugin from '../main';
import { openMetadataLookup } from '../ui/metadata-lookup';
import { getActiveContentItem } from '../utils/helpers';

export function registerMetadataCommand(plugin: ContentLogPlugin): void {
	plugin.addCommand({
		id: 'lookup-metadata',
		name: 'Найти метаданные контента',
		checkCallback: (checking) => {
			const item = getActiveContentItem(plugin);
			const kind = item ? metadataKindForContent(item.type) : null;
			if (!item || !kind || !plugin.metadataProviders.getForKind(kind).length) {
				return false;
			}
			if (!checking) {
				openMetadataLookup(plugin, item, (details) => {
					void writeMediaMetadata(plugin.app, item, details).catch((error) => {
						console.error('content-log: metadata update failed', error);
						new Notice('Не удалось записать метаданные');
					});
				});
			}
			return true;
		},
	});
}
