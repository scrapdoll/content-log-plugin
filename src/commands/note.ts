import { App, Modal, Setting } from 'obsidian';
import { createContentNote } from '../core/notes';
import type { ContentItem } from '../types';
import { reportActionError } from '../ui/action-errors';

/** Модалка создания заметки внутри папки Notes карточки контента. */
export class AddNoteModal extends Modal {
	private noteTitle = '';

	constructor(app: App, private item: ContentItem) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(`Заметка — ${this.item.title}`);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');

		new Setting(contentEl)
			.setName('Заголовок (необязательно)')
			.addText((text) => {
				text.setPlaceholder('О чём заметка').onChange((value) => {
					this.noteTitle = value;
				});
				text.inputEl.focus();
			});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText('Создать')
					.setCta()
					.onClick(() => void this.create()),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async create(): Promise<void> {
		this.close();
		try {
			const file = await createContentNote(this.app, this.item, this.noteTitle);
			if (file) {
				await this.app.workspace.getLeaf('tab').openFile(file);
			}
		} catch (error) {
			reportActionError('note creation', error, 'Не удалось создать заметку');
		}
	}
}
