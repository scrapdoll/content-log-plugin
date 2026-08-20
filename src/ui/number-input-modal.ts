import { App, Modal, Setting } from 'obsidian';

export interface NumberInputParams {
	title: string;
	value: number | null;
	placeholder?: string;
	/** Пояснение над полем ( например, текущее значение ). */
	hint?: string;
	allowEmpty?: boolean;
	minimum?: number;
	zeroIsEmpty?: boolean;
	quickValues?: ReadonlyArray<{ label: string; value: number }>;
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
			const minimum = this.params.minimum ?? 0;
			if (input.value !== '' && Number.isFinite(num) && num >= minimum) {
				this.current = this.params.zeroIsEmpty && num === 0 ? null : num;
			} else if (this.params.allowEmpty !== false) {
				this.current = null;
			}
		});
		input.focus();

		if (this.params.quickValues?.length) {
			const quick = new Setting(contentEl).setName('Быстро прибавить');
			for (const option of this.params.quickValues) {
				quick.addButton((button) =>
					button.setButtonText(option.label).onClick(() => {
						this.params.onSave(option.value);
						this.close();
					}),
				);
			}
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
						this.params.onSave(this.current);
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
