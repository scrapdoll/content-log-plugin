import {
	type App,
	type FileSystemAdapter,
	Notice,
	Platform,
	TFile,
} from 'obsidian';
import type ContentLogPlugin from '../main';
import type { ContentItem } from '../types';
import { isHttpUrl } from '../utils/guards';

/** Источник, заданный внешней ссылкой ( http/https ). */
export function isHttpSource(value: string): boolean {
	return isHttpUrl(value);
}

/**
 * Ищет файл источника в vault: путь из frontmatter как есть либо
 * относительно папки карточки. null — источник не файл.
 */
export function findSourceFile(app: App, item: ContentItem): TFile | null {
	if (!item.source || isHttpSource(item.source)) return null;
	const raw =
		item.source
			.replace(/^\[\[|\]\]$/g, '')
			.split('|')[0]
			?.trim() ?? '';
	if (!raw) return null;

	const candidates = [raw];
	const folder = item.file.parent;
	if (folder) {
		candidates.push(`${folder.path}/${raw}`);
	}
	for (const candidate of candidates) {
		const file = app.vault.getAbstractFileByPath(candidate);
		if (file instanceof TFile) return file;
	}
	return null;
}

/** Режим открытия файла-источника: авто-определение, вкладка или системное приложение. */
export type SourceOpenMode = 'auto' | 'tab' | 'system';

/** Режим открытия для конкретного расширения ( без варианта «общая настройка» ). */
export type SourceExtensionMode = 'tab' | 'system';

/** Расширения-источники с отдельной настройкой открытия в меню карточки. */
export const SOURCE_EXTENSIONS = ['epub', 'fb2', 'mobi', 'azw3'] as const;

/**
 * Открывает источник: файл — сначала настройка расширения, при
 * «общей настройке» — общий режим ( авто определяет поддержку формата
 * сам: просматриваемые Obsidian — вкладкой, остальные — системно );
 * ссылку — в браузере.
 */
export async function openSource(
	plugin: ContentLogPlugin,
	item: ContentItem,
): Promise<boolean> {
	const { app } = plugin;
	const file = findSourceFile(app, item);
	if (file) {
		const override =
			plugin.settings.sourceOpenByExtension[
				file.extension.toLowerCase()
			];
		const configuredMode = override ?? plugin.settings.sourceOpenMode;
		const effectiveMode: SourceExtensionMode =
			configuredMode === 'auto'
				? obsidianViewType(app, file.extension)
					? 'tab'
					: 'system'
				: configuredMode;
		return effectiveMode === 'tab'
			? openFileInTab(app, file)
			: openInSystemApp(app, file);
	}
	if (item.source && isHttpSource(item.source)) {
		window.open(item.source.trim(), '_blank');
		return true;
	}
	return false;
}

/** Тип представления Obsidian для расширения ( null — форматы без просмотра ). */
function obsidianViewType(app: App, extension: string): string | null {
	const registry = app as unknown as {
		viewRegistry?: {
			getTypeByExtension?: (extension: string) => string | null;
		};
	};
	const viewType = registry.viewRegistry?.getTypeByExtension?.(extension);
	return typeof viewType === 'string' && viewType ? viewType : null;
}

/**
 * Открывает файл в системном приложении: собственным методом Obsidian
 * ( так делает встроенный плагин «Open in default app», путь внутри
 * vault ), при его отсутствии — через Electron shell.
 */
async function openInSystemApp(app: App, file: TFile): Promise<boolean> {
	const withDefaultApp = app as unknown as {
		openWithDefaultApp?: (path: string) => void;
	};
	if (typeof withDefaultApp.openWithDefaultApp === 'function') {
		withDefaultApp.openWithDefaultApp(file.path);
		return true;
	}
	const opened = await openViaElectronShell(app, file);
	if (!opened) {
		new Notice('Системное открытие этого файла недоступно');
	}
	return opened;
}

/**
 * Запасной путь системного открытия через Electron ( только desktop ).
 * false — системное открытие недоступно.
 */
async function openViaElectronShell(app: App, file: TFile): Promise<boolean> {
	if (!Platform.isDesktopApp) return false;
	const nodeRequire = (
		window as unknown as {
			require?: (id: string) => unknown;
		}
	).require;
	if (typeof nodeRequire !== 'function') return false;
	try {
		const shell = (
			nodeRequire('electron') as {
				shell?: { openPath?: (path: string) => Promise<string> };
			}
		).shell;
		const adapter = app.vault.adapter as FileSystemAdapter;
		if (
			typeof shell?.openPath !== 'function' ||
			typeof adapter.getBasePath !== 'function'
		) {
			return false;
		}
		// shell.openPath нужен абсолютный путь ОС, а не путь внутри vault.
		const fullPath = `${adapter.getBasePath()}/${file.path}`;
		const errorMessage = await shell.openPath(fullPath);
		if (errorMessage) {
			console.error(`content-log: system open failed: ${errorMessage}`);
			return false;
		}
		return true;
	} catch (error) {
		console.error('content-log: system open failed', error);
	}
	return false;
}

async function openFileInTab(app: App, file: TFile): Promise<boolean> {
	try {
		await app.workspace.getLeaf('tab').openFile(file);
		return true;
	} catch (error) {
		console.error('content-log: open source failed', error);
		new Notice('Не удалось открыть источник');
		return false;
	}
}

/** Короткая подпись источника: имя файла, домен ссылки либо текст. */
export function sourceLabel(app: App, item: ContentItem): string {
	const source = item.source?.trim();
	if (!source) return '';
	const file = findSourceFile(app, item);
	if (file) return file.name;
	if (isHttpSource(source)) {
		try {
			return new URL(source).hostname.replace(/^www\./, '');
		} catch {
			return source;
		}
	}
	return source;
}
