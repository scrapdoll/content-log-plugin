import { debounce, Events, TFile, TFolder } from 'obsidian';
import type ContentLogPlugin from '../main';
import type { ContentItem } from '../types';
import { normalizeRoot } from '../utils/helpers';
import { parseContentItem } from './content-item';
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
