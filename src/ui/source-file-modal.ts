import { App, type FuzzyMatch, FuzzySuggestModal, setIcon, TFile } from 'obsidian';

/** Поиск файла в vault для источника контента ( epub, pdf и т.д. ). */
export class SourceFileModal extends FuzzySuggestModal<TFile> {
	constructor(app: App, private onChoose: (path: string) => void) {
		super(app);
		this.setPlaceholder('Выберите файл источника');
	}

	getItems(): TFile[] {
		const configDir = this.app.vault.configDir;
		return this.app.vault.getFiles().filter(
			(file) =>
				!file.path.startsWith(`${configDir}/`) &&
				!file.path.startsWith('.trash/'),
		);
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	renderSuggestion(match: FuzzyMatch<TFile>, el: HTMLElement): void {
		const file = match.item;
		el.addClass('cl-source-suggestion');
		setIcon(el.createSpan({ cls: 'cl-source-file-icon' }), 'file');
		el.createSpan({ cls: 'cl-source-file-name', text: file.name });
		el.createSpan({
			cls: 'cl-source-file-path',
			text: file.parent?.path ?? '',
		});
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file.path);
	}
}
