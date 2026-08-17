import { App, Modal, Setting } from 'obsidian';

export interface ConfirmParams {
	title: string;
	message: string;
	confirmText: string;
	cancelText?: string;
	onConfirm: () => void;
}

/** Маленькая модалка подтверждения с двумя кнопками. */
export class ConfirmModal extends Modal {
	constructor(app: App, private params: ConfirmParams) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText(this.params.title);
		contentEl.createEl('p', {
			cls: 'cl-modal-hint',
			text: this.params.message,
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(this.params.cancelText ?? 'Отмена')
					.onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.params.confirmText)
					.setCta()
					.onClick(() => {
						this.params.onConfirm();
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
