import { App, Modal, Notice, Setting } from 'obsidian';
import {
	STATUS_COLORS,
	type StatusColor,
	type StatusDef,
} from '../types';

interface StatusModalParams {
	/** Редактируемый статус или null для нового. */
	initial: StatusDef | null;
	/** id уже занятых статусов, включая встроенные (без id редактируемого). */
	existingIds: string[];
	onSave: (status: StatusDef) => void | Promise<void>;
}

const KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

const COLOR_LABELS: Record<StatusColor | 'none', string> = {
	none: 'Нейтральный',
	blue: 'Синий',
	green: 'Зелёный',
	orange: 'Оранжевый',
	red: 'Красный',
	yellow: 'Жёлтый',
	purple: 'Фиолетовый',
	cyan: 'Голубой',
	pink: 'Розовый',
};

/** Модалка создания/редактирования пользовательского статуса. */
export class StatusModal extends Modal {
	private id: string;
	private label: string;
	private color: StatusColor | null;

	constructor(app: App, private params: StatusModalParams) {
		super(app);
		this.id = params.initial?.id ?? '';
		this.label = params.initial?.label ?? '';
		this.color = params.initial?.color ?? null;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText(
			this.params.initial ? 'Изменить статус' : 'Новый статус',
		);

		new Setting(contentEl)
			.setName('Ключ (латиница)')
			.setDesc(
				'Значение поля status в frontmatter карточек. После создания не меняется.',
			)
			.addText((text) => {
				text.setPlaceholder('Например: on-hold').setValue(this.id).onChange(
					(value) => {
						this.id = value.trim();
					},
				);
				text.inputEl.disabled = this.params.initial !== null;
			});

		new Setting(contentEl).setName('Название').addText((text) =>
			text.setPlaceholder('На паузе').setValue(this.label).onChange((value) => {
				this.label = value.trim();
			}),
		);

		new Setting(contentEl).setName('Цвет').addDropdown((drop) => {
			drop.addOption('none', COLOR_LABELS.none);
			for (const color of STATUS_COLORS) {
				drop.addOption(color, COLOR_LABELS[color]);
			}
			drop.setValue(this.color ?? 'none').onChange((value) => {
				this.color = value === 'none' ? null : (value as StatusColor);
			});
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText('Сохранить')
					.setCta()
					.onClick(() => void this.submit()),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		if (this.params.initial === null) {
			if (!KEY_PATTERN.test(this.id)) {
				new Notice(
					'Ключ статуса: латиница, цифры, дефис или подчёркивание',
				);
				return;
			}
			if (this.params.existingIds.includes(this.id)) {
				new Notice('Такой ключ статуса уже занят');
				return;
			}
		}
		if (!this.label) {
			new Notice('Укажите название статуса');
			return;
		}
		this.close();
		await this.params.onSave({
			id: this.params.initial?.id ?? this.id,
			label: this.label,
			color: this.color,
		});
	}
}
