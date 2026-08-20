import { Platform, type App, type TFile } from 'obsidian';
import { extractEpub } from './epub';
import { extractFb2 } from './fb2';
import { extractMobi } from './mobi';
import { metadataToFields } from './normalize';
import { extractPdf, isEncryptedPdfError } from './pdf';
import {
	SUPPORTED_BOOK_EXTENSIONS,
	type BookExtractionResult,
	type BookSourceState,
	type RawBookMetadata,
} from './types';

export type {
	BookExtractionResult,
	BookFieldValue,
	BookTechnicalInfo,
	EmbeddedBookCover,
	ExtractedBookField,
} from './types';
export { SUPPORTED_BOOK_EXTENSIONS } from './types';

const MOBILE_MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const DESKTOP_MAX_SOURCE_BYTES = 100 * 1024 * 1024;

export interface ExtractBookSourceOptions {
	renderPdfCover?: boolean;
}

/** Читает локальный файл vault и извлекает только данные поддерживаемого формата. */
export async function extractBookFile(
	app: App,
	file: TFile,
): Promise<BookExtractionResult> {
	const buffer = await app.vault.readBinary(file);
	return extractBookSource(
		new Uint8Array(buffer),
		file.extension.toLowerCase(),
		file.name,
	);
}

/** Диспетчер форматных адаптеров; экспортирован отдельно для black-box тестов. */
export async function extractBookSource(
	bytes: Uint8Array,
	extension: string,
	fileName: string,
	options: ExtractBookSourceOptions = {},
): Promise<BookExtractionResult> {
	const normalizedExtension = extension.toLowerCase();
	if (!SUPPORTED_BOOK_EXTENSIONS.has(normalizedExtension)) {
		throw new Error(`Формат .${normalizedExtension || '?'} не поддерживается`);
	}
	const format = formatLabel(normalizedExtension);
	const fileSize = bytes.byteLength;
	const maxSourceBytes = Platform.isMobile
		? MOBILE_MAX_SOURCE_BYTES
		: DESKTOP_MAX_SOURCE_BYTES;
	if (bytes.byteLength > maxSourceBytes) {
		return result(format, fileName, fileSize, '', 'unreadable', undefined, [
			`Файл больше ${Math.round(maxSourceBytes / (1024 * 1024))} МБ; извлечение остановлено для защиты памяти`,
		]);
	}
	const sha256 = await hashBytes(bytes);

	try {
		const metadata = await extractByFormat(bytes, normalizedExtension, options);
		const warnings = metadata.warnings ?? [];
		return result(
			format,
			fileName,
			fileSize,
			sha256,
			warnings.length > 0 ? 'partial' : 'readable',
			metadata,
			warnings,
		);
	} catch (error) {
		const encrypted =
			isEncryptedPdfError(error) || /\b(?:drm|encrypted|encryption)\b/i.test(errorText(error));
		return result(
			format,
			fileName,
			fileSize,
			sha256,
			encrypted ? 'encrypted' : 'unreadable',
			undefined,
			[encrypted ? 'Файл зашифрован или защищён DRM' : errorText(error)],
		);
	}
}

function result(
	format: string,
	fileName: string,
	fileSize: number,
	sha256: string,
	state: BookSourceState,
	metadata: RawBookMetadata | undefined,
	warnings: string[],
): BookExtractionResult {
	return {
		technical: {
			format,
			fileName,
			fileSize,
			sha256,
			state,
			warnings,
		},
		fields: metadata ? metadataToFields(metadata) : [],
		cover: metadata?.cover,
	};
}

async function extractByFormat(
	bytes: Uint8Array,
	extension: string,
	options: ExtractBookSourceOptions,
): Promise<RawBookMetadata> {
	switch (extension) {
		case 'pdf':
			return extractPdf(bytes, { renderCover: options.renderPdfCover });
		case 'epub':
			return extractEpub(bytes);
		case 'fb2':
			return extractFb2(bytes);
		case 'mobi':
		case 'azw3':
			return extractMobi(bytes, extension);
		default:
			throw new Error(`Формат .${extension} не поддерживается`);
	}
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
	const input =
		bytes.buffer instanceof ArrayBuffer &&
		bytes.byteOffset === 0 &&
		bytes.byteLength === bytes.buffer.byteLength
			? bytes.buffer
			: Uint8Array.from(bytes).buffer;
	const digest = await window.crypto.subtle.digest('SHA-256', input);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function formatLabel(extension: string): string {
	return extension === 'azw3' ? 'AZW3 (KF8)' : extension.toUpperCase();
}

function errorText(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/\s+/g, ' ').trim().slice(0, 500) || 'Не удалось прочитать файл';
}
