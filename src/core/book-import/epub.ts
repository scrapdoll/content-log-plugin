import type { EmbeddedBookCover, RawBookMetadata } from './types';
import { imageExtension, isSafeRasterType } from './image';
import { cleanList, cleanText, findIsbn } from './normalize';
import {
	archiveEntry,
	normalizeArchivePath,
	unzipBookArchive,
} from './zip';
import {
	asRecord,
	attribute,
	child,
	descendants,
	nodeText,
	parseBookXml,
	records,
	scalarTexts,
	type XmlRecord,
} from './xml';

interface ManifestItem {
	id: string;
	href: string;
	mediaType: string;
	properties: string;
}

/** Извлекает пакетные метаданные, содержание и встроенную обложку EPUB. */
export function extractEpub(bytes: Uint8Array): RawBookMetadata {
	const archive = unzipBookArchive(bytes);
	const containerBytes = archiveEntry(archive, 'META-INF/container.xml');
	if (!containerBytes) throw new Error('EPUB не содержит META-INF/container.xml');
	const container = parseBookXml(containerBytes);
	const rootfile = descendants(container, 'rootfile')[0];
	const packagePath = attribute(rootfile, 'full-path');
	if (!packagePath) throw new Error('EPUB не указывает package document');
	const normalizedPackagePath = normalizeArchivePath('', packagePath);
	const packageBytes = normalizedPackagePath
		? archiveEntry(archive, normalizedPackagePath)
		: undefined;
	if (!packageBytes || !normalizedPackagePath) throw new Error('Package document EPUB не найден');

	const packageXml = parseBookXml(packageBytes);
	const packageRecord = asRecord(child(packageXml, 'package'));
	if (!packageRecord) throw new Error('Некорректный package document EPUB');
	const metadata = asRecord(child(packageRecord, 'metadata'));
	const manifest = parseManifest(asRecord(child(packageRecord, 'manifest')));
	const identifiers = scalarTexts(child(metadata, 'identifier'));
	const series = epubSeries(metadata);
	const toc = epubToc(archive, normalizedPackagePath, packageRecord, manifest);
	const cover = epubCover(archive, normalizedPackagePath, metadata, manifest);
	const warnings: string[] = [];
	if (toc.labels.length === 0) warnings.push('Содержание EPUB не найдено');

	return {
		title: scalarTexts(child(metadata, 'title'))[0],
		authors: scalarTexts(child(metadata, 'creator')),
		language: scalarTexts(child(metadata, 'language'))[0],
		publisher: scalarTexts(child(metadata, 'publisher'))[0],
		published: scalarTexts(child(metadata, 'date'))[0],
		identifiers,
		isbn: findIsbn(identifiers),
		series: series.name,
		seriesIndex: series.index,
		description: scalarTexts(child(metadata, 'description'))[0],
		subjects: scalarTexts(child(metadata, 'subject')),
		toc: toc.labels,
		chapterCount: toc.topLevelCount || undefined,
		cover,
		warnings,
	};
}

function parseManifest(manifest: XmlRecord | undefined): ManifestItem[] {
	const result: ManifestItem[] = [];
	for (const item of records(child(manifest, 'item'))) {
		const id = attribute(item, 'id');
		const href = attribute(item, 'href');
		if (!id || !href) continue;
		result.push({
			id,
			href,
			mediaType: attribute(item, 'media-type') ?? '',
			properties: attribute(item, 'properties') ?? '',
		});
	}
	return result;
}

function epubSeries(metadata: XmlRecord | undefined): {
	name?: string;
	index?: string;
} {
	const meta = records(child(metadata, 'meta'));
	const calibreName = meta.find(
		(entry) => attribute(entry, 'name')?.toLowerCase() === 'calibre:series',
	);
	const calibreIndex = meta.find(
		(entry) => attribute(entry, 'name')?.toLowerCase() === 'calibre:series_index',
	);
	if (calibreName) {
		return {
			name: cleanText(attribute(calibreName, 'content') ?? nodeText(calibreName)),
			index: cleanText(attribute(calibreIndex, 'content') ?? nodeText(calibreIndex)),
		};
	}

	const collection = meta.find(
		(entry) => attribute(entry, 'property') === 'belongs-to-collection',
	);
	if (!collection) return {};
	const collectionId = attribute(collection, 'id');
	const index = meta.find(
		(entry) =>
			attribute(entry, 'property') === 'group-position' &&
			(!collectionId || attribute(entry, 'refines') === `#${collectionId}`),
	);
	return {
		name: cleanText(nodeText(collection)),
		index: cleanText(nodeText(index)),
	};
}

function epubToc(
	archive: Record<string, Uint8Array>,
	packagePath: string,
	packageRecord: XmlRecord,
	manifest: ManifestItem[],
): { labels: string[]; topLevelCount: number } {
	const navItem = manifest.find((item) => item.properties.split(/\s+/).includes('nav'));
	if (navItem) {
		const path = normalizeArchivePath(packagePath, navItem.href);
		const bytes = path ? archiveEntry(archive, path) : undefined;
		if (bytes) {
			const document = parseBookXml(bytes);
			const nav = descendants(document, 'nav').find((entry) => {
				const type = attribute(entry, 'type') ?? '';
				const role = attribute(entry, 'role') ?? '';
				return type.split(/\s+/).includes('toc') || role === 'doc-toc';
			});
			if (nav) return labelsFromNavigation(nav);
		}
	}

	const spine = asRecord(child(packageRecord, 'spine'));
	const ncxId = attribute(spine, 'toc');
	const ncxItem = manifest.find(
		(item) => item.id === ncxId || item.mediaType === 'application/x-dtbncx+xml',
	);
	if (!ncxItem) return { labels: [], topLevelCount: 0 };
	const ncxPath = normalizeArchivePath(packagePath, ncxItem.href);
	const ncxBytes = ncxPath ? archiveEntry(archive, ncxPath) : undefined;
	if (!ncxBytes) return { labels: [], topLevelCount: 0 };
	const ncx = parseBookXml(ncxBytes);
	const navMap = descendants(ncx, 'navMap')[0];
	const topLevel = records(child(navMap, 'navPoint'));
	const labels = descendants(navMap, 'navLabel').map(nodeText).filter(Boolean);
	return { labels: cleanList(labels), topLevelCount: topLevel.length };
}

function labelsFromNavigation(nav: XmlRecord): {
	labels: string[];
	topLevelCount: number;
} {
	const anchors = descendants(nav, 'a').map(nodeText).filter(Boolean);
	const firstList = records(child(nav, 'ol'))[0];
	const topLevel = records(child(firstList, 'li'))
		.map((item) => nodeText(child(item, 'a') ?? child(item, 'span')))
		.filter(Boolean);
	return {
		labels: cleanList(anchors),
		topLevelCount: topLevel.length,
	};
}

function epubCover(
	archive: Record<string, Uint8Array>,
	packagePath: string,
	metadata: XmlRecord | undefined,
	manifest: ManifestItem[],
): EmbeddedBookCover | undefined {
	const coverId = records(child(metadata, 'meta')).find(
		(entry) => attribute(entry, 'name')?.toLowerCase() === 'cover',
	);
	const coverItem =
		manifest.find((item) => item.properties.split(/\s+/).includes('cover-image')) ??
		manifest.find((item) => item.id === attribute(coverId, 'content'));
	if (!coverItem || !isSafeRasterType(coverItem.mediaType)) return undefined;
	const path = normalizeArchivePath(packagePath, coverItem.href);
	const coverBytes = path ? archiveEntry(archive, path) : undefined;
	if (!coverBytes || coverBytes.length === 0) return undefined;
	return {
		bytes: coverBytes,
		extension: imageExtension(coverItem.mediaType),
		mediaType: coverItem.mediaType,
	};
}
