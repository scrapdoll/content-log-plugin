import { setIcon } from 'obsidian';
import type ContentLogPlugin from '../main';
import {
	findSourceFile,
	isHttpSource,
	openSource,
	sourceLabel,
} from '../core/source';
import type { ContentItem } from '../types';

/**
 * Чип источника: файл — кнопка перехода к нему, ссылка — открытие в
 * браузере, текст — обычная подпись. Используется в шапке карточки
 * и на дашборде.
 */
export function appendSourceChip(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	item: ContentItem,
): void {
	const source = item.source;
	if (!source) return;

	const { app } = plugin;
	const file = findSourceFile(app, item);
	const clickable = Boolean(file) || isHttpSource(source);
	const chip = container.createEl(clickable ? 'button' : 'span', {
		cls: 'cl-source-chip',
		attr: { title: source },
	});
	setIcon(
		chip.createSpan({ cls: 'cl-source-chip-icon' }),
		file ? 'file' : isHttpSource(source) ? 'link' : 'bookmark',
	);
	chip.createSpan({
		cls: 'cl-source-chip-label',
		text: sourceLabel(app, item),
	});

	if (clickable) {
		chip.addEventListener('click', (evt) => {
			// Клик по чипу не должен открывать саму карточку.
			evt.stopPropagation();
			void openSource(plugin, item);
		});
	}
}
