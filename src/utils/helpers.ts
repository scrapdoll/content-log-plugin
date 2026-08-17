import type ContentLogPlugin from '../main';
import { getTypeSchema } from '../core/registry';
import type { ContentItem } from '../types';

export function todayISO(): string {
	const now = new Date();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Приводит путь корневой папки к виду «путь/без/наклонных/краёв». */
export function normalizeRoot(root: string): string {
	return root.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '').trim();
}

export function progressPercent(item: ContentItem): number {
	if (!item.progress.total || item.progress.current === null) return 0;
	return Math.round((item.progress.current / item.progress.total) * 100);
}

export function progressText(item: ContentItem): string {
	const schema = getTypeSchema(item.type);
	if (!schema) return '';
	const current = item.progress.current;
	if (current === null) return '—';
	if (item.progress.total) {
		return `${current} / ${item.progress.total} ${schema.progressUnit} · ${progressPercent(item)}%`;
	}
	return `${current} ${schema.progressUnit}`;
}

export function getActiveContentItem(
	plugin: ContentLogPlugin,
): ContentItem | null {
	const file = plugin.app.workspace.getActiveFile();
	if (!file) return null;
	return plugin.index.get(file) ?? null;
}
