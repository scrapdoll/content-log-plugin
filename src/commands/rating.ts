import { App, Modal, Setting } from 'obsidian';
import { writeRating } from '../core/mutations';
import type { ContentItem } from '../types';

/** Модалка оценки карточки: звёзды 1–5 и снятие оценки. */
export class RateContentModal extends Modal {
	constructor(app: App, private item: ContentItem) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(`Оценка — ${this.item.title}`);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');

		const row = contentEl.createDiv({ cls: 'cl-rate-row' });
		for (let star = 1; star <= 5; star++) {
			const filled = this.item.rating !== null && star <= this.item.rating;
			const button = row.createEl('button', {
				cls: `cl-rate-star${filled ? ' is-filled' : ''}`,
				text: '★',
				attr: { 'aria-label': `Оценка ${star}` },
			});
			button.addEventListener('click', () => {
				this.close();
				void writeRating(this.app, this.item, star).catch((error) => {
					console.error('content-log: rating update failed', error);
				});
			});
		}

		if (this.item.rating !== null) {
			new Setting(contentEl).addButton((button) =>
				button.setButtonText('Снять оценку').onClick(() => {
					this.close();
					void writeRating(this.app, this.item, 0).catch((error) => {
						console.error('content-log: rating update failed', error);
					});
				}),
			);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
