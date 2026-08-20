import { App, debounce, Events, TFile, TFolder } from 'obsidian';
import type ContentLogPlugin from '../main';
import { getTypeSchema, isKnownType } from './registry';
import {
	type ContentItem,
	type HltbTimes,
	type TypeSchema,
	toStatus,
} from '../types';
import { normalizeRoot } from '../utils/helpers';
import { frontmatterRepository } from './frontmatter';
import {
	isContentCardPath,
	isInsideRoot,
	removeIndexedPath,
} from './index-state';

const REFRESH_DELAY_MS = 400;

/**
 * Индекс контента: сканирует корневую папку, опознаёт карточки по полю
 * type во frontmatter и уведомляет дашборд об изменениях (событие changed).
 */
export class ContentIndex extends Events {
	private items = new Map<string, ContentItem>();
	private pendingPaths = new Set<string>();
	private scheduleRefresh = debounce(
		() => this.flushPendingPaths(),
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
		const rootFolder = vault.getAbstractFileByPath(root);
		if (rootFolder instanceof TFolder) {
			this.visitFolder(root, rootFolder);
		}
		this.trigger('changed');
	}

	private maybeRefresh(...paths: string[]): void {
		const root = normalizeRoot(this.plugin.settings.rootFolder);
		if (!root) return;
		let queued = false;
		for (const path of paths) {
			if (!isInsideRoot(root, path)) continue;
			this.pendingPaths.add(path);
			queued = true;
		}
		if (queued) {
			this.scheduleRefresh();
		}
	}

	private flushPendingPaths(): void {
		const root = normalizeRoot(this.plugin.settings.rootFolder);
		const paths = [...this.pendingPaths];
		this.pendingPaths.clear();
		if (!root || paths.length === 0) return;

		const { vault } = this.plugin.app;
		let touched = false;
		for (const path of paths) {
			if (!isInsideRoot(root, path)) continue;
			touched = true;
			const entry = vault.getAbstractFileByPath(path);
			if (entry instanceof TFile && isContentCardPath(root, path)) {
				const item = parseContentItem(this.plugin.app, entry);
				if (item) {
					this.items.set(path, item);
				} else {
					this.items.delete(path);
				}
			} else if (entry instanceof TFolder) {
				removeIndexedPath(this.items, path);
				this.visitFolder(root, entry);
			} else if (!entry) {
				removeIndexedPath(this.items, path);
			}
		}
		if (touched) this.trigger('changed');
	}

	private visitFolder(root: string, folder: TFolder): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				if (child.name !== 'Notes') this.visitFolder(root, child);
				continue;
			}
			if (!(child instanceof TFile) || !isContentCardPath(root, child.path)) {
				continue;
			}
			const item = parseContentItem(this.plugin.app, child);
			if (item) this.items.set(child.path, item);
		}
	}
}

/** Собирает ContentItem из уже прочитанного frontmatter. */
export function contentItemFromFrontmatter(
	file: TFile,
	fm: Record<string, unknown>,
): ContentItem | null {
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
		title:
			typeof fm['title'] === 'string' && fm['title']
				? fm['title']
				: file.basename,
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
		rating: ratingFrom(fm['rating']),
		cover: textOrNull(fm['cover']),
		source: textOrNull(fm['source']),
		description: textOrNull(fm['description']),
		hltb: hltbFromFrontmatter(fm),
		started: dateString(fm['started']),
		finished: dateString(fm['finished']),
	};
}

export function parseContentItem(
	app: App,
	file: TFile,
): ContentItem | null {
	const fm: Record<string, unknown> | undefined =
		frontmatterRepository(app).readCached(file) ?? undefined;
	if (!fm) return null;
	return contentItemFromFrontmatter(file, fm);
}

function numOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hltbFromFrontmatter(fm: Record<string, unknown>): HltbTimes | null {
	const id = numOrNull(fm['hltb-id']);
	const main = numOrNull(fm['hltb-main']);
	const extra = numOrNull(fm['hltb-extra']);
	const complete = numOrNull(fm['hltb-complete']);
	if (id === null && main === null && extra === null && complete === null) {
		return null;
	}
	return { id, main, extra, complete };
}

function ratingFrom(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rating = Math.round(value);
	return rating >= 1 && rating <= 5 ? rating : null;
}

function dateString(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

function textOrNull(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}
