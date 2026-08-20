import { App, Modal, Setting } from 'obsidian';

export interface NumberInputParams {
	title: string;
	value: number | null;
	placeholder?: string;
	/** Пояснение над полем ( например, текущее значение ). */
	hint?: string;
	onSave: (value: number | null) => void;
}

/** Маленькая модалка одного числового поля. Пустое поле снимает значение. */
export class NumberInputModal extends Modal {
	private current: number | null;

	constructor(app: App, private params: NumberInputParams) {
		super(app);
		this.current = params.value;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText(this.params.title);

		if (this.params.hint) {
			contentEl.createEl('p', {
				cls: 'cl-modal-hint',
				text: this.params.hint,
			});
		}

		const input = contentEl.createEl('input', {
			cls: 'cl-text-input',
			attr: {
				type: 'number',
				min: '0',
				step: 'any',
				placeholder: this.params.placeholder ?? '',
			},
		});
		input.value =
			this.params.value === null ? '' : String(this.params.value);
		input.addEventListener('input', () => {
			const num = Number(input.value);
			this.current =
				input.value !== '' && Number.isFinite(num) && num > 0
					? num
					: null;
		});
		input.focus();

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText('Сохранить')
					.setCta()
					.onClick(() => {
						this.params.onSave(this.current);
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
