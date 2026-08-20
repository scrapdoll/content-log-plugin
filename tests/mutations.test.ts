import { beforeEach, describe, expect, it } from 'vitest';
import {
	writeCover,
	writeDescription,
	writeSource,
} from '../src/core/mutations';
import type { ContentItem } from '../src/types';
import { Notice, TFile } from './obsidian';

describe('text field mutations', () => {
	beforeEach(() => {
		Notice.messages = [];
	});

	it('writes and removes fields through the shared frontmatter boundary', async () => {
		const stored: Record<string, unknown> = { source: 'old' };
		const app = {
			fileManager: {
				processFrontMatter: async (
					_file: TFile,
					mutation: (frontmatter: Record<string, unknown>) => void,
				) => mutation(stored),
			},
		};
		const item = {
			file: new TFile('Content/Book/Book.md'),
		} as unknown as ContentItem;

		await writeCover(app as never, item, 'cover.jpg');
		await writeDescription(app as never, item, 'Описание');
		await writeSource(app as never, item, null);

		expect(stored).toEqual({ cover: 'cover.jpg', description: 'Описание' });
		expect(Notice.messages).toEqual([
			'Обложка обновлена',
			'Описание обновлено',
			'Источник убран',
		]);
	});
});
