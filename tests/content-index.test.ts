import { describe, expect, it } from 'vitest';
import { ContentIndex } from '../src/core/index';
import { rebuildTypeRegistry } from '../src/core/registry';
import { TFile, TFolder } from './obsidian';

type VaultCallback = (file: TFile | TFolder, oldPath?: string) => void;

describe('ContentIndex incremental updates', () => {
	it('reparses only the changed card and removes deleted folders', () => {
		rebuildTypeRegistry([]);
		const root = new TFolder('Content Log');
		const books = new TFolder('Content Log/Books');
		const dune = new TFile('Content Log/Books/Dune.md');
		const foundation = new TFile('Content Log/Books/Foundation.md');
		books.children.push(dune, foundation);
		root.children.push(books);

		const entries = new Map<string, TFile | TFolder>([
			[root.path, root],
			[books.path, books],
			[dune.path, dune],
			[foundation.path, foundation],
		]);
		const callbacks = new Map<string, VaultCallback>();
		const cacheReads: string[] = [];
		const frontmatter = new Map([
			[dune.path, { type: 'book', title: 'Дюна', status: 'planned' }],
			[
				foundation.path,
				{ type: 'book', title: 'Основание', status: 'planned' },
			],
		]);
		const app = {
			vault: {
				on: (name: string, callback: VaultCallback) => {
					callbacks.set(name, callback);
					return {};
				},
				getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
			},
			metadataCache: {
				getFileCache: (file: TFile) => {
					cacheReads.push(file.path);
					return { frontmatter: frontmatter.get(file.path) };
				},
			},
		};
		const plugin = {
			app,
			settings: { rootFolder: root.path },
			registerEvent: () => undefined,
		};
		const index = new ContentIndex(
			plugin as unknown as ConstructorParameters<typeof ContentIndex>[0],
		);

		index.init();
		expect(index.getAll().map((item) => item.title)).toEqual(['Дюна', 'Основание']);
		cacheReads.length = 0;

		frontmatter.set(dune.path, {
			type: 'book',
			title: 'Дюна Мессия',
			status: 'planned',
		});
		callbacks.get('modify')?.(dune);
		expect(cacheReads).toEqual([dune.path]);
		expect(
			index.get(dune as unknown as Parameters<ContentIndex['get']>[0])?.title,
		).toBe('Дюна Мессия');

		entries.delete(books.path);
		callbacks.get('delete')?.(books);
		expect(index.getAll()).toEqual([]);
	});
});
