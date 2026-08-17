import { App, Modal, Notice, Setting } from 'obsidian';

const URL_PATTERN = /^https?:\/\/\S+$/i;

/** Модалка обложки по внешней ссылке, с живым превью картинки. */
export class CoverUrlModal extends Modal {
	constructor(app: App, private onChoose: (url: string) => void) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText('Обложка по ссылке');

		new Setting(contentEl)
			.setName('Ссылка на картинку')
			.setDesc(
				'Картинка будет загружаться с этого адреса при показе обложки.',
			);

		const input = contentEl.createEl('input', {
			cls: 'cl-cover-url-input',
			attr: { type: 'url', placeholder: 'https://example.com/cover.jpg' },
		});
		const preview = contentEl.createDiv({ cls: 'cl-cover-preview' });
		input.addEventListener('input', () => {
			preview.empty();
			const url = input.value.trim();
			if (URL_PATTERN.test(url)) {
				preview.createEl('img', { attr: { src: url, alt: '' } });
			}
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText('Сохранить')
					.setCta()
					.onClick(() => {
						const url = input.value.trim();
						if (!URL_PATTERN.test(url)) {
							new Notice('Некорректная ссылка на картинку');
							return;
						}
						this.onChoose(url);
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
