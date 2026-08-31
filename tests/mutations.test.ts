import { beforeEach, describe, expect, it } from 'vitest';
import {
	writeCover,
	writeContentCard,
	writeDescription,
	writeMediaMetadata,
	writeSource,
} from '../src/core/mutations';
import type { ContentItem } from '../src/types';
import { Notice, TFile } from './obsidian';
import { rebuildTypeRegistry } from '../src/core/registry';

describe('text field mutations', () => {
	beforeEach(() => {
		Notice.messages = [];
		rebuildTypeRegistry([]);
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

	it('writes provider-neutral metadata without replacing user content', async () => {
		const stored: Record<string, unknown> = {
			cover: 'local-cover.jpg',
			description: 'Моя заметка',
			'episodes-watched': 30,
			status: 'in-progress',
		};
		const app = {
			fileManager: {
				processFrontMatter: async (
					_file: TFile,
					mutation: (frontmatter: Record<string, unknown>) => void,
				) => mutation(stored),
			},
		};
		const item = {
			type: 'series',
			file: new TFile('Content/Series/Dark/Dark.md'),
		} as unknown as ContentItem;

		await writeMediaMetadata(app as never, item, {
			providerId: 'tmdb',
			itemId: 'tv:70523',
			kind: 'series',
			title: 'Тьма',
			originalTitle: 'Dark',
			year: 2017,
			overview: 'Описание TMDb',
			posterUrl: 'https://image.tmdb.org/poster.jpg',
			rating: 8.4,
			director: '',
			creator: 'Баран бо Одар',
			studio: 'Wiedemann & Berg',
			runtimeMinutes: 53,
			seasonsTotal: 3,
			episodesTotal: 26,
			genres: 'Драма, Детектив',
			providerUrl: 'https://www.themoviedb.org/tv/70523',
		});

		expect(stored).toMatchObject({
			cover: 'local-cover.jpg',
			description: 'Моя заметка',
			'metadata-provider': 'tmdb',
			'metadata-id': 'tv:70523',
			'metadata-url': 'https://www.themoviedb.org/tv/70523',
			'metadata-rating': 8.4,
			'original-title': 'Dark',
			year: 2017,
			creator: 'Баран бо Одар',
			'seasons-total': 3,
			'episodes-total': 26,
			'episodes-watched': 26,
			status: 'finished',
		});
	});

	it('edits known card fields while preserving unrelated frontmatter', async () => {
		const stored: Record<string, unknown> = {
			title: 'Old title',
			type: 'book',
			status: 'finished',
			author: 'Old author',
			'pages-total': 100,
			cover: 'old.jpg',
			source: 'old source',
			description: 'old description',
			started: '2024-01-01',
			finished: '2024-01-02',
			'custom-unknown': 'preserved',
		};
		const app = {
			fileManager: {
				processFrontMatter: async (
					_file: TFile,
					mutation: (frontmatter: Record<string, unknown>) => void,
				) => mutation(stored),
			},
		};
		const item = {
			type: 'book',
			file: new TFile('Content/Books/Book/Book.md'),
		} as unknown as ContentItem;

		await writeContentCard(app as never, item, {
			title: 'New title',
			status: 'planned',
			fields: { author: 'New author' },
			cover: null,
			source: '  new source  ',
			description: null,
		});

		expect(stored).toEqual({
			title: 'New title',
			type: 'book',
			status: 'planned',
			author: 'New author',
			source: 'new source',
			'custom-unknown': 'preserved',
		});
		expect(Notice.messages).toEqual(['Карточка обновлена']);
	});

	it('does not rewrite lifecycle dates when status did not change', async () => {
		const stored: Record<string, unknown> = {
			title: 'Book',
			type: 'book',
			status: 'finished',
			started: '2024-01-01',
			finished: '2024-01-02',
		};
		const app = {
			fileManager: {
				processFrontMatter: async (
					_file: TFile,
					mutation: (frontmatter: Record<string, unknown>) => void,
				) => mutation(stored),
			},
		};
		const item = {
			type: 'book',
			file: new TFile('Content/Books/Book/Book.md'),
		} as unknown as ContentItem;

		await writeContentCard(app as never, item, {
			title: 'Renamed book',
			status: 'finished',
			fields: {},
			cover: null,
			source: null,
			description: null,
		});

		expect(stored.started).toBe('2024-01-01');
		expect(stored.finished).toBe('2024-01-02');
	});
});
