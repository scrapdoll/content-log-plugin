import {
	Decoration,
	type DecorationSet,
	EditorView,
	WidgetType,
} from '@codemirror/view';
import { type EditorState, StateField } from '@codemirror/state';
import type { Text } from '@codemirror/state';
import { editorInfoField, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { contentItemFromFrontmatter } from '../core/index';
import { parseFrontmatterText } from '../core/frontmatter';
import type { ContentItem } from '../types';
import { buildCardHeaderPanel } from './card-header';

/**
 * Та же интерактивная шапка карточки, но в live preview:
 * CodeMirror 6 widget над началом документа.
 */
class CardHeaderWidget extends WidgetType {
	constructor(
		private plugin: ContentLogPlugin,
		private item: ContentItem,
	) {
		super();
	}

	eq(other: CardHeaderWidget): boolean {
		const a = this.item;
		const b = other.item;
		return (
			a.file.path === b.file.path &&
			a.status === b.status &&
			a.progress.current === b.progress.current &&
			a.progress.total === b.progress.total &&
			a.rating === b.rating &&
			a.cover === b.cover &&
			a.source === b.source &&
			a.description === b.description &&
			a.hltb?.id === b.hltb?.id &&
			a.hltb?.main === b.hltb?.main &&
			a.hltb?.extra === b.hltb?.extra &&
			a.hltb?.complete === b.hltb?.complete
		);
	}

	toDOM(): HTMLElement {
		const container = createDiv();
		buildCardHeaderPanel(this.plugin, container, this.item);
		return container;
	}
}

function buildDecorations(
	plugin: ContentLogPlugin,
	state: EditorState,
): DecorationSet {
	const file = state.field(editorInfoField, false)?.file;
	if (!(file instanceof TFile)) return Decoration.none;

	const fm = parseFrontmatterText(state.doc.toString());
	if (!fm) return Decoration.none;

	const item = contentItemFromFrontmatter(file, fm);
	if (!item) return Decoration.none;

	const anchor = panelAnchor(state.doc);
	if (anchor === null) return Decoration.none;

	return Decoration.set(
		Decoration.widget({
			widget: new CardHeaderWidget(plugin, item),
			side: -1000,
			block: true,
		}).range(anchor),
	);
}

/**
 * Позиция блочного виджета: строка после заголовка карточки, а если
 * заголовка нет — первая строка после frontmatter. Позиция 0 не подходит:
 * диапазон frontmatter в live preview заменяется панелью свойств, и
 * виджет внутри него не отображается.
 */
function panelAnchor(doc: Text): number | null {
	const total = doc.lines;
	if (total === 0 || doc.line(1).text.trim() !== '---') return null;

	let afterFrontmatter: number | null = null;
	for (let index = 2; index <= total; index++) {
		const line = doc.line(index);
		if (afterFrontmatter === null) {
			if (line.text.trim() === '---') {
				afterFrontmatter = Math.min(line.to + 1, doc.length);
			}
			continue;
		}
		if (/^#\s/.test(line.text)) {
			return Math.min(line.to + 1, doc.length);
		}
	}
	return afterFrontmatter;
}

export function registerLivePreviewHeader(plugin: ContentLogPlugin): void {
	// Блочные виджеты нельзя задавать через ViewPlugin — только через
	// StateField, иначе CodeMirror бросает RangeError при открытии файла.
	const headerField = StateField.define<DecorationSet>({
		create: (state) => buildDecorations(plugin, state),
		update: (value, tr) =>
			tr.docChanged ? buildDecorations(plugin, tr.state) : value,
		provide: (field) => EditorView.decorations.from(field),
	});
	plugin.registerEditorExtension(headerField);
}
