import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { editorInfoField, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import { contentItemFromFrontmatter } from '../core/index';
import type { ContentItem } from '../types';
import { parseFrontmatterText } from '../utils/helpers';
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
			a.cover === b.cover
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
	view: EditorView,
): DecorationSet {
	const file = view.state.field(editorInfoField, false)?.file;
	if (!(file instanceof TFile)) return Decoration.none;

	const fm = parseFrontmatterText(view.state.doc.toString());
	if (!fm) return Decoration.none;

	const item = contentItemFromFrontmatter(file, fm);
	if (!item) return Decoration.none;

	return Decoration.set(
		Decoration.widget({
			widget: new CardHeaderWidget(plugin, item),
			side: -1000,
		}).range(0),
	);
}

export function registerLivePreviewHeader(plugin: ContentLogPlugin): void {
	const extension = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(plugin, view);
			}

			update(update: ViewUpdate): void {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildDecorations(plugin, update.view);
				}
			}
		},
		{ decorations: (instance) => instance.decorations },
	);
	plugin.registerEditorExtension(extension);
}
