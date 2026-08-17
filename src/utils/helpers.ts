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

/**
 * Простой парсер frontmatter из текста заметки — для live preview,
 * где данные читаются прямо из документа, а не из metadataCache.
 * Поддерживает блоковые скаляры ( «>» / «|» ), которыми Obsidian
 * записывает многострочные значения.
 */
export function parseFrontmatterText(
	text: string,
): Record<string, unknown> | null {
	const lines = text.split('\n');
	if (lines[0]?.trim() !== '---') return null;
	const fm: Record<string, unknown> = {};
	let closed = false;
	let index = 1;
	while (index < lines.length) {
		const line = lines[index] ?? '';
		if (line.trim() === '---') {
			closed = true;
			break;
		}
		const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!match) {
			index++;
			continue;
		}
		const key = match[1] ?? '';
		const raw = (match[2] ?? '').trim().replace(/^["']|["']$/g, '');
		const block = /^([>|])[+-]?\d*$/.exec(raw);
		if (block) {
			const parts: string[] = [];
			index++;
			while (index < lines.length && (lines[index] ?? '').startsWith('  ')) {
				parts.push((lines[index] ?? '').trim());
				index++;
			}
			fm[key] = parts.join(block[1] === '>' ? ' ' : '\n');
			continue;
		}
		if (raw !== '' && Number.isFinite(Number(raw))) {
			fm[key] = Number(raw);
		} else {
			fm[key] = raw;
		}
		index++;
	}
	return closed ? fm : null;
}

export function getActiveContentItem(
	plugin: ContentLogPlugin,
): ContentItem | null {
	const file = plugin.app.workspace.getActiveFile();
	if (!file) return null;
	return plugin.index.get(file) ?? null;
}
