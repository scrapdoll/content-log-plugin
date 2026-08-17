import { App, debounce, Events, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { getTypeSchema, isKnownType } from './registry';
import {
	type ContentItem,
	type TypeSchema,
	toStatus,
} from '../types';
import { normalizeRoot } from '../utils/helpers';

const REFRESH_DELAY_MS = 400;

/**
 * Индекс контента: сканирует корневую папку, опознаёт карточки по полю
 * type во frontmatter и уведомляет дашборд об изменениях (событие changed).
 */
export class ContentIndex extends Events {
	private items = new Map<string, ContentItem>();
	private scheduleRefresh = debounce(
		() => this.rebuild(),
		REFRESH_DELAY_MS,
		true,
	);

	constructor(private plugin: ContentLogPlugin) {
		super();
	}

	/** Вызывается из onLayoutReady: подписки на vault и первичный скан. */
	init(): void {
		const { vault } = this.plugin.app;
		this.plugin.registerEvent(
			vault.on('create', (file) => this.maybeRefresh(file.path)),
		);
		this.plugin.registerEvent(
			vault.on('modify', (file) => this.maybeRefresh(file.path)),
		);
		this.plugin.registerEvent(
			vault.on('delete', (file) => this.maybeRefresh(file.path)),
		);
		this.plugin.registerEvent(
			vault.on('rename', (file, oldPath) =>
				this.maybeRefresh(oldPath, file.path),
			),
		);
		this.rebuild();
	}

	getAll(): ContentItem[] {
		return [...this.items.values()];
	}

	get(file: TFile): ContentItem | undefined {
		return this.items.get(file.path);
	}

	rebuild(): void {
		const root = normalizeRoot(this.plugin.settings.rootFolder);
		const { vault } = this.plugin.app;
		this.items.clear();
		if (!root) {
			this.trigger('changed');
			return;
		}
		for (const file of vault.getMarkdownFiles()) {
			if (!file.path.startsWith(`${root}/`)) continue;
			if (file.path.includes('/Notes/')) continue;
			const item = parseContentItem(this.plugin.app, file);
			if (item) this.items.set(file.path, item);
		}
		this.trigger('changed');
	}

	private maybeRefresh(...paths: string[]): void {
		const root = normalizeRoot(this.plugin.settings.rootFolder);
		if (!root) return;
		if (paths.some((p) => p === root || p.startsWith(`${root}/`))) {
			this.scheduleRefresh();
		}
	}
}

export function parseContentItem(
	app: App,
	file: TFile,
): ContentItem | null {
	const fm: Record<string, unknown> | undefined =
		app.metadataCache.getFileCache(file)?.frontmatter;
	if (!fm) return null;

	const type = fm['type'];
	if (!isKnownType(type)) return null;
	const schema: TypeSchema | undefined = getTypeSchema(type);
	if (!schema) return null;

	const fields: Record<string, string | number> = {};
	for (const field of schema.fields) {
		const value = fm[field.key];
		if (typeof value === 'string' || typeof value === 'number') {
			fields[field.key] = value;
		}
	}

	return {
		file,
		type,
		title: typeof fm['title'] === 'string' && fm['title'] ? fm['title'] : file.basename,
		status: toStatus(fm['status']),
		fields,
		progress: {
			current: numOrNull(
				schema.progressField ? fm[schema.progressField] : undefined,
			),
			total: numOrNull(
				schema.progressTotalField ? fm[schema.progressTotalField] : undefined,
			),
		},
		started: dateString(fm['started']),
		finished: dateString(fm['finished']),
	};
}

function numOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dateString(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}
