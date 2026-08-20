import { App, TFile } from 'obsidian';
import type { ContentItem } from '../types';
import { isHttpUrl } from '../utils/guards';

const IMAGE_EXTENSIONS = new Set([
	'png',
	'jpg',
	'jpeg',
	'webp',
	'gif',
	'svg',
	'avif',
	'bmp',
]);

export function isImageFile(file: TFile): boolean {
	return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

/** Обложка, заданная внешней ссылкой ( http/https ), а не файлом vault. */
export function isRemoteCover(value: string): boolean {
	return isHttpUrl(value);
}

/** Готовый src для тега img: внешняя ссылка как есть либо ресурс vault. */
export function resolveCoverSrc(app: App, item: ContentItem): string | null {
	if (item.cover && isRemoteCover(item.cover)) {
		return item.cover.trim();
	}
	const file = findCoverFile(app, item);
	return file ? app.vault.getResourcePath(file) : null;
}

/**
 * Ищет обложку карточки: сначала явный путь из frontmatter ( cover ),
 * затем первый рисунок рядом с карточкой ( не в Notes ).
 */
export function findCoverFile(app: App, item: ContentItem): TFile | null {
	const folder = item.file.parent;

	if (item.cover) {
		const candidates = [item.cover];
		if (folder) {
			candidates.push(`${folder.path}/${item.cover}`);
		}
		for (const candidate of candidates) {
			const resolved = resolveToImage(app, candidate);
			if (resolved) return resolved;
		}
	}

	if (!folder) return null;
	const images = app.vault
		.getFiles()
		.filter(
			(file) => file.parent?.path === folder.path && isImageFile(file),
		)
		.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
	return images[0] ?? null;
}

function resolveToImage(app: App, path: string): TFile | null {
	const cleaned =
		path
			.replace(/^\[\[|\]\]$/g, '')
			.split('|')[0]
			?.trim() ?? '';
	if (!cleaned) return null;
	const file = app.vault.getAbstractFileByPath(cleaned);
	return file instanceof TFile && isImageFile(file) ? file : null;
}
