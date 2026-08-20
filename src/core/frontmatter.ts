import {
	getFrontMatterInfo,
	parseYaml,
	type App,
	type TFile,
} from 'obsidian';
import { isRecord } from '../utils/guards';

export type Frontmatter = Record<string, unknown>;
export type FrontmatterMutation = (frontmatter: Frontmatter) => void;

/** Единственная Obsidian-зависимая точка чтения и записи frontmatter. */
export class ObsidianFrontmatterRepository {
	constructor(private app: App) {}

	readCached(file: TFile): Frontmatter | null {
		const value: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return isRecord(value) ? value : null;
	}

	async read(file: TFile): Promise<Frontmatter | null> {
		const text = await this.app.vault.cachedRead(file);
		return parseFrontmatterText(text);
	}

	async update(file: TFile, mutation: FrontmatterMutation): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, mutation);
	}
}

const repositories = new WeakMap<App, ObsidianFrontmatterRepository>();

export function frontmatterRepository(app: App): ObsidianFrontmatterRepository {
	let repository = repositories.get(app);
	if (!repository) {
		repository = new ObsidianFrontmatterRepository(app);
		repositories.set(app, repository);
	}
	return repository;
}

/** Разбирает документ публичным YAML API Obsidian. */
export function parseFrontmatterText(text: string): Frontmatter | null {
	const info = getFrontMatterInfo(text);
	if (!info.exists) return null;
	try {
		const parsed: unknown = parseYaml(info.frontmatter);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
