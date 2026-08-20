export type BookFieldValue = string | number | string[];

export type BookFieldOrigin = 'embedded' | 'structure' | 'computed';

export interface ExtractedBookField {
	key: string;
	label: string;
	value: BookFieldValue;
	origin: BookFieldOrigin;
	confidence: 'high' | 'medium';
}

export interface EmbeddedBookCover {
	bytes: Uint8Array;
	extension: string;
	mediaType: string;
}

export interface RawBookMetadata {
	title?: string;
	authors?: string[];
	language?: string;
	publisher?: string;
	published?: string;
	identifiers?: string[];
	isbn?: string;
	series?: string;
	seriesIndex?: string;
	description?: string;
	subjects?: string[];
	pageCount?: number;
	toc?: string[];
	chapterCount?: number;
	cover?: EmbeddedBookCover;
	warnings?: string[];
}

export type BookSourceState =
	| 'readable'
	| 'partial'
	| 'encrypted'
	| 'unreadable';

export interface BookTechnicalInfo {
	format: string;
	fileName: string;
	fileSize: number;
	sha256: string;
	state: BookSourceState;
	warnings: string[];
}

export interface BookExtractionResult {
	technical: BookTechnicalInfo;
	fields: ExtractedBookField[];
	cover?: EmbeddedBookCover;
}

export const SUPPORTED_BOOK_EXTENSIONS = new Set([
	'pdf',
	'epub',
	'fb2',
	'mobi',
	'azw3',
]);
