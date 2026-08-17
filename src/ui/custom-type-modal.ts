import { App, Modal, Notice, Setting } from 'obsidian';
import type { FieldDef, FieldKind, TypeSchema } from '../types';

interface CustomTypeModalParams {
	/** Редактируемая схема или null для нового типа. */
	initial: TypeSchema | null;
	/** id уже занятых типов (без id редактируемого). */
	existingIds: string[];
	onSave: (schema: TypeSchema) => void | Promise<void>;
}

interface FieldDraft {
	key: string;
	label: string;
	kind: FieldKind;
}

/** Модалка создания/редактирования кастомного типа контента. */
export class CustomTypeModal extends Modal {
	private id: string;
	private label: string;
	private icon: string;
	private folder: string;
	private hasProgress: boolean;
	private unit: string;
	private progressKey: string;
	private totalKey: string;
	private quickSteps: string;
	private fields: FieldDraft[];
	private subtitleField: string;

	constructor(app: App, private params: CustomTypeModalParams) {
		super(app);
		const init = params.initial;
		this.id = init?.id ?? '';
		this.label = init?.label ?? '';
		this.icon = init?.icon ?? 'tag';
		this.folder = init?.folder ?? '';
		this.hasProgress = Boolean(init?.progressField);
		this.unit = init?.progressUnit ?? '';
		this.progressKey = init?.progressField ?? 'progress-current';
		this.totalKey = init?.progressTotalField ?? '';
		this.quickSteps = (init?.progressQuickSteps ?? [10]).join(', ');
		this.fields = (init?.fields ?? []).map((field) => ({
			key: field.key,
			label: field.label,
			kind: field.kind,
		}));
		this.subtitleField = init?.subtitleField ?? '';
	}

	onOpen(): void {
		this.renderModal();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderModal(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		this.titleEl.setText(
			this.params.initial ? 'Изменить тип контента' : 'Новый тип контента',
		);

		new Setting(contentEl)
			.setName('Ключ типа (латиница)')
			.setDesc(
				'Значение поля type в frontmatter карточек. После создания не меняется.',
			)
			.addText((text) => {
				text.setPlaceholder('Например: podcast')
					.setValue(this.id)
					.onChange((value) => {
						this.id = value.trim();
					});
				text.inputEl.disabled = this.params.initial !== null;
			});

		new Setting(contentEl).setName('Название').addText((text) =>
			text.setPlaceholder('Мой подкаст').setValue(this.label).onChange(
				(value) => {
					this.label = value.trim();
				},
			),
		);

		new Setting(contentEl)
			.setName('Иконка (lucide)')
			.setDesc('Например: tag, tv, headphones')
			.addText((text) =>
				text.setValue(this.icon).onChange((value) => {
					this.icon = value.trim();
				}),
			);

		new Setting(contentEl)
			.setName('Папка')
			.setDesc('Подпапка внутри корневой папки. По умолчанию — название.')
			.addText((text) =>
				text.setPlaceholder('Подкасты').setValue(this.folder).onChange(
					(value) => {
						this.folder = value.trim();
					},
				),
			);

		new Setting(contentEl)
			.setName('Прогресс')
			.setDesc('Единицы прогресса: серии, выпуски, часы…')
			.addToggle((toggle) =>
				toggle.setValue(this.hasProgress).onChange((value) => {
					this.hasProgress = value;
					this.renderModal();
				}),
			);

		if (this.hasProgress) {
			new Setting(contentEl).setName('Единица').addText((text) =>
				text.setPlaceholder('сер.').setValue(this.unit).onChange((value) => {
					this.unit = value.trim();
				}),
			);
			new Setting(contentEl)
				.setName('Ключ прогресса')
				.setDesc('Ключ frontmatter для текущего значения.')
				.addText((text) =>
					text.setValue(this.progressKey).onChange((value) => {
						this.progressKey = value.trim();
					}),
				);
			new Setting(contentEl)
				.setName('Ключ максимума (необязательно)')
				.setDesc('Если задан, на дашборде показывается прогресс-бар.')
				.addText((text) =>
					text.setValue(this.totalKey).onChange((value) => {
						this.totalKey = value.trim();
					}),
				);
			new Setting(contentEl)
				.setName('Быстрые кнопки')
				.setDesc('Числа через запятую, например: 1, 5')
				.addText((text) =>
					text.setPlaceholder('10').setValue(this.quickSteps).onChange(
						(value) => {
							this.quickSteps = value;
						},
					),
				);
		}

		contentEl.createDiv({
			cls: 'cl-modal-section',
			text: 'Поля карточки',
		});
		if (this.fields.length === 0) {
			contentEl.createDiv({
				cls: 'cl-modal-hint',
				text: 'Дополнительных полей нет — карточка будет содержать только название и статус.',
			});
		} else {
			const list = contentEl.createDiv({ cls: 'cl-fields-list' });
			for (const field of this.fields) {
				this.renderFieldRow(list, field);
			}
		}
		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText('+ Поле')
				.onClick(() => {
					this.fields.push({ key: '', label: '', kind: 'text' });
					this.renderModal();
				}),
		);

		const textFields = this.fields.filter((f) => f.kind === 'text');
		new Setting(contentEl)
			.setName('Подзаголовок на дашборде')
			.addDropdown((drop) => {
				drop.addOption('', 'Нет');
				for (const field of textFields) {
					drop.addOption(field.key, field.label || field.key);
				}
				drop.setValue(this.subtitleField).onChange((value) => {
					this.subtitleField = value;
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

	private renderFieldRow(list: HTMLElement, field: FieldDraft): void {
		const row = list.createDiv({ cls: 'cl-field-row' });

		const keyInput = row.createEl('input', {
			type: 'text',
			cls: 'cl-field-key',
			attr: { placeholder: 'ключ (латиница)' },
		});
		keyInput.value = field.key;
		keyInput.addEventListener('change', () => {
			field.key = keyInput.value.trim();
		});

		const labelInput = row.createEl('input', {
			type: 'text',
			cls: 'cl-field-label',
			attr: { placeholder: 'Название поля' },
		});
		labelInput.value = field.label;
		labelInput.addEventListener('change', () => {
			field.label = labelInput.value.trim();
		});

		const kindSelect = row.createEl('select', { cls: 'cl-field-kind' });
		kindSelect.createEl('option', { value: 'text', text: 'Текст' });
		kindSelect.createEl('option', { value: 'number', text: 'Число' });
		kindSelect.value = field.kind;
		kindSelect.addEventListener('change', () => {
			field.kind = kindSelect.value as FieldKind;
		});

		const removeButton = row.createEl('button', {
			text: '×',
			attr: { 'aria-label': 'Удалить поле' },
		});
		removeButton.addEventListener('click', () => {
			this.fields = this.fields.filter((f) => f !== field);
			this.renderModal();
		});
	}

	private async submit(): Promise<void> {
		const isNew = this.params.initial === null;
		if (isNew) {
			if (!/^[a-zA-Z0-9_-]+$/.test(this.id)) {
				new Notice('Ключ типа: латиница, цифры, дефис или подчёркивание');
				return;
			}
			if (this.params.existingIds.includes(this.id)) {
				new Notice('Такой ключ типа уже занят');
				return;
			}
		}
		if (!this.label) {
			new Notice('Укажите название типа');
			return;
		}

		const fields: FieldDef[] = [];
		const seenKeys = new Set<string>();
		for (const field of this.fields) {
			if (!field.key || !field.label) {
				new Notice('У каждого поля заполните ключ и название');
				return;
			}
			if (!/^[a-zA-Z0-9_-]+$/.test(field.key)) {
				new Notice(`Ключ поля «${field.label}»: латиница, цифры, дефис`);
				return;
			}
			if (seenKeys.has(field.key)) {
				new Notice(`Дублирующийся ключ поля: ${field.key}`);
				return;
			}
			seenKeys.add(field.key);
			fields.push({ key: field.key, label: field.label, kind: field.kind });
		}

		let progressField: string | null = null;
		let progressTotalField: string | null = null;
		let progressUnit = '';
		let progressQuickSteps: number[] = [];
		if (this.hasProgress) {
			if (!this.unit) {
				new Notice('Укажите единицу прогресса');
				return;
			}
			progressField = this.progressKey || 'progress-current';
			progressTotalField = this.totalKey || null;
			progressUnit = this.unit;
			const steps = this.quickSteps
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean)
				.map(Number);
			if (steps.some((step) => !Number.isFinite(step) || step <= 0)) {
				new Notice('Быстрые кнопки: положительные числа через запятую');
				return;
			}
			progressQuickSteps = steps;
		}

		const subtitle = fields.find(
			(f) => f.key === this.subtitleField && f.kind === 'text',
		);

		const schema: TypeSchema = {
			id: this.params.initial?.id ?? this.id,
			label: this.label,
			icon: this.icon || 'tag',
			folder: this.folder || this.label,
			subtitleField: subtitle ? subtitle.key : null,
			fields,
			progressField,
			progressTotalField,
			progressUnit,
			progressQuickSteps,
		};

		this.close();
		await this.params.onSave(schema);
	}
}
