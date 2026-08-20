import { beforeEach, describe, expect, it } from 'vitest';
import { openSource } from '../src/core/source';
import type { ContentItem } from '../src/types';
import { Notice, TFile } from './obsidian';

function contentItem(file: TFile, source: string): ContentItem {
	return {
		file: file as unknown as ContentItem['file'],
		type: 'book',
		title: 'Книга',
		status: 'planned',
		fields: {},
		progress: { current: null, total: null },
		rating: null,
		cover: null,
		source,
		description: null,
		hltb: null,
		started: null,
		finished: null,
	};
}

function pluginFor(
	sourceFile: TFile,
	mode: 'auto' | 'tab' | 'system',
	failTabOpen = false,
) {
	const opened: TFile[] = [];
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) =>
				path === sourceFile.path ? sourceFile : null,
		},
		workspace: {
			getLeaf: () => ({
				openFile: async (file: TFile) => {
					if (failTabOpen) throw new Error('test open failure');
					opened.push(file);
				},
			}),
		},
	};
	return {
		plugin: {
			app,
			settings: {
				sourceOpenMode: mode,
				sourceOpenByExtension: {},
			},
		} as unknown as Parameters<typeof openSource>[0],
		opened,
	};
}

describe('openSource', () => {
	beforeEach(() => {
		Notice.messages = [];
	});

	it('returns false and reports unsupported system opening', async () => {
		const sourceFile = new TFile('Books/book.epub');
		const { plugin, opened } = pluginFor(sourceFile, 'system');
		const item = contentItem(new TFile('Content/Book/Book.md'), sourceFile.path);

		await expect(openSource(plugin, item)).resolves.toBe(false);
		expect(opened).toEqual([]);
		expect(Notice.messages).toEqual([
			'Системное открытие этого файла недоступно',
		]);
	});

	it('returns true only after opening a file in an Obsidian tab', async () => {
		const sourceFile = new TFile('Books/book.pdf');
		const { plugin, opened } = pluginFor(sourceFile, 'tab');
		const item = contentItem(new TFile('Content/Book/Book.md'), sourceFile.path);

		await expect(openSource(plugin, item)).resolves.toBe(true);
		expect(opened).toEqual([sourceFile]);
		expect(Notice.messages).toEqual([]);
	});

	it('returns false when opening an Obsidian tab fails', async () => {
		const sourceFile = new TFile('Books/book.pdf');
		const { plugin, opened } = pluginFor(sourceFile, 'tab', true);
		const item = contentItem(new TFile('Content/Book/Book.md'), sourceFile.path);

		await expect(openSource(plugin, item)).resolves.toBe(false);
		expect(opened).toEqual([]);
		expect(Notice.messages).toEqual(['Не удалось открыть источник']);
	});
});
