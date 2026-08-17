import { App, type FuzzyMatch, FuzzySuggestModal, TFile } from 'obsidian';
import { isImageFile } from '../core/cover';

/** Поиск картинки по vault для обложки карточки контента. */
export class CoverSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(app: App, private onChoose: (path: string) => void) {
		super(app);
		this.setPlaceholder('Выберите картинку для обложки');
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter(isImageFile);
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	renderSuggestion(match: FuzzyMatch<TFile>, el: HTMLElement): void {
		const file = match.item;
		el.addClass('cl-cover-suggestion');
		el.createEl('img', {
			cls: 'cl-cover-thumb',
			attr: {
				src: this.app.vault.getResourcePath(file),
				alt: file.name,
				loading: 'lazy',
			},
		});
		el.createSpan({ text: file.path });
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file.path);
	}
}
