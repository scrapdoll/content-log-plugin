import { Notice, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { getTypeSchema } from '../core/registry';
import { DEFAULT_SETTINGS } from '../settings';
import { STATUSES } from '../types';
import { normalizeRoot, progressText, todayISO } from '../utils/helpers';

/**
 * Генерирует <root>/Dashboard.md со списком всего контента по статусам.
 * Файл перезаписывается при каждом экспорте.
 */
export async function exportDashboardMarkdown(
	plugin: ContentLogPlugin,
): Promise<void> {
	const { app } = plugin;
	const items = plugin.index.getAll();
	const root =
		normalizeRoot(plugin.settings.rootFolder) || DEFAULT_SETTINGS.rootFolder;
	const collator = new Intl.Collator('ru', { sensitivity: 'base' });

	const lines: string[] = [
		'# Content log',
		'',
		`Сгенерировано плагином Content Log · ${todayISO()}`,
		'',
	];

	for (const status of STATUSES) {
		const group = items
			.filter((item) => item.status === status.id)
			.sort((a, b) => collator.compare(a.title, b.title));
		lines.push(`## ${status.label} (${group.length})`, '');
		if (group.length === 0) {
			lines.push('—', '');
			continue;
		}
		for (const item of group) {
			const schema = getTypeSchema(item.type);
			const bits: string[] = [];
			if (schema?.subtitleField) {
				const subtitle = String(item.fields[schema.subtitleField] ?? '');
				if (subtitle) bits.push(subtitle);
			}
			if (schema?.progressField) bits.push(progressText(item));
			if (item.rating !== null) {
				bits.push(`${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}`);
			}
			if (item.started) bits.push(`с ${item.started}`);
			if (item.finished) bits.push(`завершено ${item.finished}`);
			const link = `[[${item.file.path.replace(/\.md$/, '')}|${item.title}]]`;
			lines.push(`- ${link}${bits.length > 0 ? ` — ${bits.join(' · ')}` : ''}`);
		}
		lines.push('');
	}

	const content = lines.join('\n');
	const path = `${root}/Dashboard.md`;
	try {
		const existing = app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await app.vault.modify(existing, content);
		} else {
			await app.vault.create(path, content);
		}
		new Notice(`Дашборд экспортирован: ${path}`);
	} catch (error) {
		new Notice('Не удалось экспортировать дашборд');
		console.error('content-log: export failed', error);
	}
}
