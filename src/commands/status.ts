import { App, Modal } from 'obsidian';
import { writeStatus } from '../core/mutations';
import { STATUSES, type ContentItem } from '../types';
import { runCardAction } from '../ui/action-errors';

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
				runCardAction(
					'status update',
					undefined,
					writeStatus(this.app, this.item, status.id),
					'Не удалось обновить статус',
				);
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
