import { Platform } from 'obsidian';
import type {
	PDFDocumentProxy,
	PDFPageProxy,
} from 'pdfjs-dist/types/src/display/api';
import { cleanList, cleanText } from './normalize';
import type { EmbeddedBookCover, RawBookMetadata } from './types';

const MAX_OUTLINE_ITEMS = 500;
const MOBILE_MAX_COVER_PIXELS = 1_500_000;
const DESKTOP_MAX_COVER_PIXELS = 2_500_000;
const MOBILE_MAX_COVER_DIMENSION = 1_600;
const DESKTOP_MAX_COVER_DIMENSION = 2_000;
const JPEG_QUALITY = 0.84;

interface PdfOutlineItem {
	title: string;
	items?: PdfOutlineItem[];
}

interface PdfJsWorkerGlobal {
	pdfjsWorker?: { WorkerMessageHandler: unknown };
}

let pdfJsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | undefined;

export interface ExtractPdfOptions {
	renderCover?: boolean;
}

/** Одним PDF.js-документом читает метаданные, страницы, bookmarks и обложку. */
export async function extractPdf(
	bytes: Uint8Array,
	options: ExtractPdfOptions = {},
): Promise<RawBookMetadata> {
	const pdfjs = await loadPdfJs();
	const mobile = Platform.isMobile;
	const loadingTask = pdfjs.getDocument({
		data: bytes,
		isEvalSupported: false,
		useWorkerFetch: false,
		useSystemFonts: true,
		maxImageSize: mobile ? 16_000_000 : 32_000_000,
		canvasMaxAreaInBytes: mobile ? 24 * 1024 * 1024 : 64 * 1024 * 1024,
		verbosity: 0,
	});
	let document: PDFDocumentProxy | undefined;
	try {
		document = await loadingTask.promise;
		const [metadata, outlineItems] = await Promise.all([
			document.getMetadata(),
			document.getOutline(),
		]);
		const info = metadata.info as Record<string, unknown>;
		const outline = flattenOutline(outlineItems ?? []);
		const warnings: string[] = [];
		if (outline.labels.length === 0) warnings.push('Закладки PDF не найдены');

		let cover: EmbeddedBookCover | undefined;
		if (options.renderCover !== false) {
			try {
				cover = await renderFirstPage(document, mobile);
				if (!cover) warnings.push('Первую страницу PDF не удалось сохранить как обложку');
			} catch (error) {
				console.error('content-log: PDF cover render failed', error);
				warnings.push('Первую страницу PDF не удалось отрисовать как обложку');
			}
		}

		const keywords = infoText(info, 'Keywords')
			?.split(/[,;]\s*|\s{2,}/)
			.filter(Boolean);
		return {
			title:
				infoText(info, 'Title') ?? metadataText(metadata.metadata, 'dc:title'),
			authors: splitAuthors(
				infoText(info, 'Author') ?? metadataText(metadata.metadata, 'dc:creator'),
			),
			description:
				infoText(info, 'Subject') ?? metadataText(metadata.metadata, 'dc:description'),
			subjects: keywords,
			pageCount: document.numPages,
			toc: outline.labels,
			chapterCount: outline.topLevelCount || undefined,
			cover,
			warnings,
		};
	} finally {
		if (document) await document.destroy();
		else await loadingTask.destroy();
	}
}

export function isEncryptedPdfError(error: unknown): boolean {
	return (
		(error instanceof Error && error.name === 'PasswordException') ||
		/password|encrypted|encryption/i.test(error instanceof Error ? error.message : '')
	);
}

export function pdfCoverDimensions(
	width: number,
	height: number,
	isMobile: boolean,
): { width: number; height: number; scale: number } {
	if (!(width > 0) || !(height > 0)) throw new Error('Некорректный размер страницы PDF');
	const maxPixels = isMobile ? MOBILE_MAX_COVER_PIXELS : DESKTOP_MAX_COVER_PIXELS;
	const maxDimension = isMobile
		? MOBILE_MAX_COVER_DIMENSION
		: DESKTOP_MAX_COVER_DIMENSION;
	const scale = Math.min(
		maxDimension / Math.max(width, height),
		Math.sqrt(maxPixels / (width * height)),
	);
	return {
		width: Math.max(1, Math.floor(width * scale)),
		height: Math.max(1, Math.floor(height * scale)),
		scale,
	};
}

async function loadPdfJs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
	pdfJsPromise ??= Promise.all([
		import('pdfjs-dist/legacy/build/pdf.mjs'),
		import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
	]).then(([pdfjs, worker]) => {
		(window as unknown as PdfJsWorkerGlobal).pdfjsWorker = {
			WorkerMessageHandler: worker.WorkerMessageHandler,
		};
		return pdfjs;
	});
	return pdfJsPromise;
}

async function renderFirstPage(
	pdfDocument: PDFDocumentProxy,
	isMobile: boolean,
): Promise<EmbeddedBookCover | undefined> {
	const page = await pdfDocument.getPage(1);
	let canvas: HTMLCanvasElement | undefined;
	try {
		const baseViewport = page.getViewport({ scale: 1 });
		const dimensions = pdfCoverDimensions(
			baseViewport.width,
			baseViewport.height,
			isMobile,
		);
		const viewport = page.getViewport({ scale: dimensions.scale });
		const targetCanvas = createEl('canvas');
		canvas = targetCanvas;
		targetCanvas.width = dimensions.width;
		targetCanvas.height = dimensions.height;
		const context = targetCanvas.getContext('2d', { alpha: false });
		if (!context) return undefined;
		await page.render({
			canvasContext: context,
			viewport,
			background: '#ffffff',
		}).promise;
		const blob = await canvasToBlob(targetCanvas, 'image/jpeg', JPEG_QUALITY);
		if (!blob) return undefined;
		return {
			bytes: new Uint8Array(await blob.arrayBuffer()),
			extension: 'jpg',
			mediaType: 'image/jpeg',
		};
	} finally {
		releasePage(page, canvas);
	}
}

function releasePage(page: PDFPageProxy, canvas: HTMLCanvasElement | undefined): void {
	page.cleanup();
	if (canvas) {
		canvas.width = 0;
		canvas.height = 0;
		canvas.remove();
	}
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: string,
	quality: number,
): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function flattenOutline(items: PdfOutlineItem[]): {
	labels: string[];
	topLevelCount: number;
} {
	const labels: string[] = [];
	const visit = (entries: PdfOutlineItem[], depth: number): void => {
		if (depth > 50) return;
		for (const item of entries) {
			if (item.title?.trim()) labels.push(item.title);
			if (labels.length >= MAX_OUTLINE_ITEMS) return;
			if (item.items) visit(item.items, depth + 1);
		}
	};
	visit(items, 0);
	return {
		labels: cleanList(labels, MAX_OUTLINE_ITEMS),
		topLevelCount: items.filter((item) => Boolean(item.title?.trim())).length,
	};
}

function infoText(info: Record<string, unknown>, key: string): string | undefined {
	return typeof info[key] === 'string' ? cleanText(info[key]) : undefined;
}

function metadataText(
	metadata: { get(name: string): string | null } | undefined,
	key: string,
): string | undefined {
	return cleanText(metadata?.get(key) ?? undefined);
}

function splitAuthors(value: string | undefined): string[] {
	return value ? value.split(/\s*;\s*/).filter(Boolean) : [];
}
