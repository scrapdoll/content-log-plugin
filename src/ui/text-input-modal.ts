import { App, Modal, Setting } from 'obsidian';

export interface TextInputParams {
	title: string;
	value: string;
	/** textarea вместо однострочного input. */
	multiline?: boolean;
	placeholder?: string;
	onSave: (value: string) => void;
}

/** Маленькая модалка одного текстового поля: input или textarea. */
export class TextInputModal extends Modal {
	constructor(app: App, private params: TextInputParams) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText(this.params.title);

		let current = this.params.value;
		if (this.params.multiline) {
			const area = contentEl.createEl('textarea', {
				cls: 'cl-text-area',
				attr: {
					rows: '4',
					placeholder: this.params.placeholder ?? '',
				},
			});
			area.value = this.params.value;
			area.addEventListener('input', () => {
				current = area.value;
			});
		} else {
			const input = contentEl.createEl('input', {
				cls: 'cl-text-input',
				attr: {
					type: 'text',
					placeholder: this.params.placeholder ?? '',
				},
			});
			input.value = this.params.value;
			input.addEventListener('input', () => {
				current = input.value;
			});
			input.focus();
		}

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText('Сохранить')
					.setCta()
					.onClick(() => {
						this.params.onSave(current.trim());
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
