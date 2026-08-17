import { App, Modal } from 'obsidian';
import { writeStatus } from '../core/mutations';
import { STATUSES, type ContentItem } from '../types';

/** Модалка выбора статуса текущей карточки. */
export class UpdateStatusModal extends Modal {
	constructor(app: App, private item: ContentItem) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(`Статус — ${this.item.title}`);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		for (const status of STATUSES) {
			const button = contentEl.createEl('button', {
				cls: 'cl-status-option',
				text: status.label,
			});
			if (status.id === this.item.status) {
				button.addClass('is-active');
			}
			button.addEventListener('click', () => {
				this.close();
				void writeStatus(this.app, this.item, status.id).catch(
					(error) => {
						console.error('content-log: status update failed', error);
					},
				);
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
