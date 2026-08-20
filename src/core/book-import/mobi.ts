import {
	initKf8File,
	initMobiFile,
	type Kf8TocItem,
	type MobiMetadata,
	type MobiTocItem,
} from '@lingo-reader/mobi-parser';
import { cleanList, findIsbn } from './normalize';
import type { EmbeddedBookCover, RawBookMetadata } from './types';
import { imageExtension, isSafeRasterType } from './image';

const MAX_COVER_BYTES = 32 * 1024 * 1024;
const MAX_TOC_ITEMS = 500;

interface MobiBookParser {
	getMetadata(): MobiMetadata;
	getToc(): Array<MobiTocItem | Kf8TocItem>;
	getCoverImage(): string;
	destroy(): void;
}

/** Извлекает EXTH-метаданные, NCX-содержание и обложку MOBI/KF8. */
export async function extractMobi(
	bytes: Uint8Array,
	extension: 'mobi' | 'azw3',
): Promise<RawBookMetadata> {
	const parser: MobiBookParser =
		extension === 'azw3'
			? await initKf8File(bytes)
			: await initMobiFile(bytes);
	try {
		const metadata = parser.getMetadata();
		const toc = parser.getToc();
		return mobiMetadataToRaw(
			metadata,
			toc,
			await readBlobCover(parser.getCoverImage()),
		);
	} finally {
		parser.destroy();
	}
}

export function mobiMetadataToRaw(
	metadata: MobiMetadata,
	toc: Array<MobiTocItem | Kf8TocItem>,
	cover?: EmbeddedBookCover,
): RawBookMetadata {
	const labels = flattenToc(toc);
	return {
		title: metadata.title,
		authors: metadata.author,
		language: metadata.language,
		publisher: metadata.publisher,
		published: metadata.published,
		identifiers: metadata.identifier ? [metadata.identifier] : [],
		isbn: findIsbn([metadata.identifier]),
		description: metadata.description,
		subjects: metadata.subject,
		toc: labels,
		chapterCount: toc.filter((item) => Boolean(item.label?.trim())).length || undefined,
		cover,
		warnings: labels.length === 0 ? ['Содержание MOBI не найдено'] : [],
	};
}

function flattenToc(items: Array<MobiTocItem | Kf8TocItem>): string[] {
	const labels: string[] = [];
	const visit = (entries: Array<MobiTocItem | Kf8TocItem>, depth: number): void => {
		if (depth > 50) return;
		for (const entry of entries) {
			if (entry.label?.trim()) labels.push(entry.label);
			if (labels.length >= MAX_TOC_ITEMS) return;
			if (entry.children) visit(entry.children, depth + 1);
		}
	};
	visit(items, 0);
	return cleanList(labels, MAX_TOC_ITEMS);
}

async function readBlobCover(url: string): Promise<EmbeddedBookCover | undefined> {
	if (!url) return undefined;
	const response = await window.fetch(url);
	if (!response.ok) return undefined;
	const buffer = await response.arrayBuffer();
	if (buffer.byteLength === 0 || buffer.byteLength > MAX_COVER_BYTES) return undefined;
	const mediaType = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
	if (!isSafeRasterType(mediaType)) return undefined;
	return {
		bytes: new Uint8Array(buffer),
		extension: imageExtension(mediaType),
		mediaType,
	};
}
