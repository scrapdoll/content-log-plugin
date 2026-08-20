import { describe, expect, it } from 'vitest';
import { ObsidianFrontmatterRepository } from '../src/core/frontmatter';
import { TFile } from './obsidian';

describe('ObsidianFrontmatterRepository', () => {
	it('reads cache, reads document YAML and delegates atomic updates', async () => {
		const file = new TFile('Content/Book.md');
		const cached = { type: 'book', title: 'Из кеша' };
		const stored = { status: 'planned' } as Record<string, unknown>;
		const app = {
			metadataCache: {
				getFileCache: () => ({ frontmatter: cached }),
			},
			vault: {
				cachedRead: async () => '---\ntitle: "1984"\n---\n',
			},
			fileManager: {
				processFrontMatter: async (
					_target: TFile,
					mutation: (frontmatter: Record<string, unknown>) => void,
				) => mutation(stored),
			},
		};
		const repository = new ObsidianFrontmatterRepository(
			app as unknown as ConstructorParameters<typeof ObsidianFrontmatterRepository>[0],
		);

		expect(repository.readCached(file as never)).toBe(cached);
		await expect(repository.read(file as never)).resolves.toEqual({ title: '1984' });
		await repository.update(file as never, (fm) => {
			fm['status'] = 'finished';
		});
		expect(stored).toEqual({ status: 'finished' });
	});
});
