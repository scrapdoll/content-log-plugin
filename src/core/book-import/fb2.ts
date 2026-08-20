import { cleanList, cleanText, findIsbn } from './normalize';
import type { EmbeddedBookCover, RawBookMetadata } from './types';
import { imageExtension, isSafeRasterType } from './image';
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

const MAX_COVER_BYTES = 32 * 1024 * 1024;

/** Извлекает описание, структуру и встроенную обложку FictionBook 2. */
export function extractFb2(bytes: Uint8Array): RawBookMetadata {
	const document = parseBookXml(bytes);
	const fictionBook = asRecord(child(document, 'FictionBook'));
	if (!fictionBook) throw new Error('Некорректный документ FB2');
	const description = asRecord(child(fictionBook, 'description'));
	const titleInfo = asRecord(child(description, 'title-info'));
	const publishInfo = asRecord(child(description, 'publish-info'));
	const documentInfo = asRecord(child(description, 'document-info'));
	const sequence = records(child(titleInfo, 'sequence'))[0];
	const isbn = scalarTexts(child(publishInfo, 'isbn'))[0];
	const documentId = scalarTexts(child(documentInfo, 'id'))[0];
	const published = fb2Published(titleInfo, publishInfo);
	const toc = fb2Toc(fictionBook);

	return {
		title: scalarTexts(child(titleInfo, 'book-title'))[0],
		authors: records(child(titleInfo, 'author')).map(authorName).filter(Boolean),
		language: scalarTexts(child(titleInfo, 'lang'))[0],
		publisher: scalarTexts(child(publishInfo, 'publisher'))[0],
		published,
		identifiers: cleanList([isbn, documentId].filter(isString), 20),
		isbn: findIsbn([isbn].filter(isString)),
		series: attribute(sequence, 'name'),
		seriesIndex: attribute(sequence, 'number'),
		description: nodeText(child(titleInfo, 'annotation')),
		subjects: scalarTexts(child(titleInfo, 'genre')),
		toc: toc.labels,
		chapterCount: toc.topLevelCount || undefined,
		cover: fb2Cover(fictionBook, titleInfo),
		warnings: toc.labels.length === 0 ? ['Содержание FB2 не найдено'] : [],
	};
}

function authorName(author: XmlRecord): string {
	const nickname = scalarTexts(child(author, 'nickname'))[0];
	const parts = [
		scalarTexts(child(author, 'first-name'))[0],
		scalarTexts(child(author, 'middle-name'))[0],
		scalarTexts(child(author, 'last-name'))[0],
	].filter(isString);
	return cleanText(parts.join(' ')) ?? cleanText(nickname) ?? '';
}

function fb2Published(
	titleInfo: XmlRecord | undefined,
	publishInfo: XmlRecord | undefined,
): string | undefined {
	const year = scalarTexts(child(publishInfo, 'year'))[0];
	if (year) return cleanText(year);
	const date = records(child(titleInfo, 'date'))[0];
	return cleanText(attribute(date, 'value') ?? nodeText(date));
}

function fb2Toc(fictionBook: XmlRecord): {
	labels: string[];
	topLevelCount: number;
} {
	const bodies = records(child(fictionBook, 'body'));
	const mainBody = bodies.find((body) => {
		const name = attribute(body, 'name');
		return !name || name.toLowerCase() === 'main';
	});
	if (!mainBody) return { labels: [], topLevelCount: 0 };
	const sections = descendants(mainBody, 'section');
	const labels = sections
		.map((section) => nodeText(child(section, 'title')))
		.filter(Boolean);
	const topLevelCount = records(child(mainBody, 'section')).filter((section) =>
		Boolean(nodeText(child(section, 'title'))),
	).length;
	return { labels: cleanList(labels), topLevelCount };
}

function fb2Cover(
	fictionBook: XmlRecord,
	titleInfo: XmlRecord | undefined,
): EmbeddedBookCover | undefined {
	const image = descendants(child(titleInfo, 'coverpage'), 'image')[0];
	const href = attribute(image, 'href')?.replace(/^#/, '');
	if (!href) return undefined;
	const binary = records(child(fictionBook, 'binary')).find(
		(entry) => attribute(entry, 'id') === href,
	);
	const encoded = nodeText(binary).replace(/\s+/g, '');
	if (!binary || !encoded || encoded.length > MAX_COVER_BYTES * 1.4) return undefined;
	const mediaType = attribute(binary, 'content-type') ?? 'application/octet-stream';
	if (!isSafeRasterType(mediaType)) return undefined;
	try {
		const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
		if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) return undefined;
		return {
			bytes,
			extension: imageExtension(mediaType),
			mediaType,
		};
	} catch {
		return undefined;
	}
}

function isString(value: string | undefined): value is string {
	return typeof value === 'string' && value.length > 0;
}
