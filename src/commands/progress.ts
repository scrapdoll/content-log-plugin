import { App, Modal, Setting } from 'obsidian';
import { writeProgress } from '../core/mutations';
import { getTypeSchema } from '../core/registry';
import type { ContentItem } from '../types';
import { progressText } from '../utils/helpers';

/** Модалка обновления прогресса: точное значение или быстрые «+N». */
export class UpdateProgressModal extends Modal {
	private nextValue: number;

	constructor(
		app: App,
		private item: ContentItem,
		private onSaved?: () => void,
	) {
		super(app);
		this.nextValue = item.progress.current ?? 0;
	}

	onOpen(): void {
		const schema = getTypeSchema(this.item.type);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText(`Прогресс — ${this.item.title}`);
		contentEl.createEl('p', {
			cls: 'cl-modal-hint',
			text: `Сейчас: ${progressText(this.item)}. Поле задаёт новое значение, кнопки прибавляют.`,
		});

		if (schema?.progressField) {
			new Setting(contentEl)
				.setName(`Новое значение (${schema.progressUnit})`)
				.addText((text) => {
					text.setPlaceholder(
						String(this.item.progress.current ?? '0'),
					).onChange((value) => {
						const num = Number(value);
						this.nextValue =
							value !== '' && Number.isFinite(num)
								? num
								: (this.item.progress.current ?? 0);
					});
					text.inputEl.type = 'number';
				});

			if (schema.progressQuickSteps.length > 0) {
				const quick = new Setting(contentEl).setName('Быстро прибавить');
				for (const step of schema.progressQuickSteps) {
					quick.addButton((button) =>
						button
							.setButtonText(`+${step} ${schema.progressUnit}`)
							.onClick(() =>
								void this.apply(
									(this.item.progress.current ?? 0) + step,
								),
							),
					);
				}
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
					.onClick(() => void this.apply(this.nextValue)),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async apply(value: number): Promise<void> {
		this.close();
		try {
			await writeProgress(this.app, this.item, value);
			this.onSaved?.();
		} catch (error) {
			console.error('content-log: progress update failed', error);
		}
	}
}
