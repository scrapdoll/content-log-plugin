import { unzipSync } from 'fflate';

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;

/** Проверяет размеры ZIP до распаковки, чтобы ограничить zip-bomb и path traversal. */
export function unzipBookArchive(bytes: Uint8Array): Record<string, Uint8Array> {
	validateCentralDirectory(bytes);
	return unzipSync(bytes);
}

export function archiveEntry(
	archive: Record<string, Uint8Array>,
	path: string,
): Uint8Array | undefined {
	const normalized = normalizeArchivePath('', path);
	return normalized ? archive[normalized] : undefined;
}

export function normalizeArchivePath(baseFile: string, href: string): string | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(href.split('#')[0] ?? '');
	} catch {
		return null;
	}
	decoded = decoded.replace(/\\/g, '/');
	if (!decoded || decoded.startsWith('/') || /^[a-z]+:/i.test(decoded)) return null;
	const baseParts = baseFile.split('/').slice(0, -1);
	const parts = [...baseParts, ...decoded.split('/')];
	const normalized: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (normalized.length === 0) return null;
			normalized.pop();
		} else {
			normalized.push(part);
		}
	}
	return normalized.join('/');
}

function validateCentralDirectory(bytes: Uint8Array): void {
	if (bytes.length < 22) throw new Error('Повреждён ZIP-каталог EPUB');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const minimum = Math.max(0, bytes.length - 65_557);
	let endOffset = -1;
	for (let offset = bytes.length - 22; offset >= minimum; offset--) {
		if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
			endOffset = offset;
			break;
		}
	}
	if (endOffset < 0) throw new Error('В EPUB не найден ZIP-каталог');

	const entryCount = view.getUint16(endOffset + 10, true);
	const directorySize = view.getUint32(endOffset + 12, true);
	const directoryOffset = view.getUint32(endOffset + 16, true);
	if (entryCount > MAX_ARCHIVE_ENTRIES) throw new Error('Слишком много файлов в EPUB');
	if (directoryOffset + directorySize > bytes.length) throw new Error('Повреждён ZIP-каталог EPUB');

	let offset = directoryOffset;
	let totalSize = 0;
	for (let index = 0; index < entryCount; index++) {
		if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
			throw new Error('Повреждён ZIP-каталог EPUB');
		}
		const uncompressedSize = view.getUint32(offset + 24, true);
		const nameLength = view.getUint16(offset + 28, true);
		const extraLength = view.getUint16(offset + 30, true);
		const commentLength = view.getUint16(offset + 32, true);
		if (uncompressedSize === 0xffffffff) throw new Error('ZIP64 EPUB не поддерживается');
		if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error('Слишком большой файл внутри EPUB');
		totalSize += uncompressedSize;
		if (totalSize > MAX_UNCOMPRESSED_BYTES) throw new Error('EPUB слишком велик после распаковки');

		const nameStart = offset + 46;
		const nameEnd = nameStart + nameLength;
		if (nameEnd > bytes.length) throw new Error('Повреждён ZIP-каталог EPUB');
		const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));
		if (!normalizeArchivePath('', name)) {
			throw new Error('Небезопасный путь внутри EPUB');
		}
		offset = nameEnd + extraLength + commentLength;
	}
}
