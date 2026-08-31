import {
	App,
	Modal,
	Notice,
	Setting,
	setIcon,
	type TextComponent,
} from 'obsidian';
import type ContentLogPlugin from '../main';
import { createContentItem } from '../core/scaffold';
import { writeContentCard } from '../core/mutations';
import { getAllTypeSchemas, getTypeSchema } from '../core/registry';
import {
	STATUSES,
	type ContentItem,
	type ContentStatus,
	type ContentTypeId,
	toStatus,
} from '../types';
import { CoverSuggestModal } from './cover-picker';
import { CoverUrlModal } from './cover-url-modal';
import { ConfirmModal } from './confirm-modal';
import { SourceFileModal } from './source-file-modal';

/** Общая форма создания и редактирования карточки контента. */
export class AddContentModal extends Modal {
	private selected: ContentTypeId | null;
	private values: Record<string, string>;
	private status: ContentStatus;
	private coverPath: string | null;
	private duplicateConfirmed = false;
	private sourceInput: TextComponent | null = null;
	private coverSettingHost: HTMLElement | null = null;

	constructor(
		app: App,
		private plugin: ContentLogPlugin,
		private editingItem: ContentItem | null = null,
	) {
		super(app);
		this.selected = editingItem?.type ?? null;
		this.values = editingItem
			? {
					title: editingItem.title,
					source: editingItem.source ?? '',
					description: editingItem.description ?? '',
					...Object.fromEntries(
						Object.entries(editingItem.fields).map(([key, value]) => [
							key,
							String(value),
						]),
					),
				}
			: {};
		this.status = editingItem?.status ?? 'in-progress';
		this.coverPath = editingItem?.cover ?? null;
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.sourceInput = null;
		this.coverSettingHost = null;
		contentEl.addClass('content-log-modal');
		if (this.selected === null) {
			this.renderTypePicker();
		} else {
			this.renderForm();
		}
	}

	private renderTypePicker(): void {
		this.titleEl.setText('Что добавляем?');
		const grid = this.contentEl.createDiv({ cls: 'cl-type-grid' });
		for (const schema of getAllTypeSchemas()) {
			const button = grid.createDiv({ cls: 'cl-type-button' });
			setIcon(button.createDiv({ cls: 'cl-type-icon' }), schema.icon);
			button.createDiv({ cls: 'cl-type-label', text: schema.label });
			button.addEventListener('click', () => {
				this.selected = schema.id;
				this.render();
			});
		}
	}

	private renderForm(): void {
		const schema = this.selected ? getTypeSchema(this.selected) : null;
		if (!schema) return;
		this.titleEl.setText(
			this.editingItem
				? `Редактировать: ${this.editingItem.title}`
				: `Новая ${schema.label.toLowerCase()}`,
		);

		new Setting(this.contentEl)
			.setName('Название')
			.addText((text) => {
				text.setPlaceholder('Название')
					.setValue(this.values['title'] ?? '')
					.onChange((value) => {
						this.values['title'] = value;
					});
				text.inputEl.focus();
			});

		for (const field of schema.fields) {
			new Setting(this.contentEl).setName(field.label).addText((text) =>
				text
					.setPlaceholder(field.placeholder ?? '')
					.setValue(this.values[field.key] ?? '')
					.onChange((value) => {
						this.values[field.key] = value;
					}),
			);
		}

		new Setting(this.contentEl).setName('Статус').addDropdown((drop) => {
			for (const status of STATUSES) {
				drop.addOption(status.id, status.label);
			}
			drop.setValue(this.status).onChange((value) => {
				this.status = toStatus(value);
			});
		});

		const sourceSetting = new Setting(this.contentEl)
			.setName('Источник')
			.setDesc('Где взять: файл, ссылка или название');
		sourceSetting.addText((text) => {
			this.sourceInput = text;
			text.setPlaceholder('Файл, ссылка или текст')
				.setValue(this.values['source'] ?? '')
				.onChange((value) => {
					this.values['source'] = value;
				});
		});
		sourceSetting.addButton((button) =>
			button.setButtonText('Файл').onClick(() => {
				new SourceFileModal(this.app, (path) => {
					this.values['source'] = path;
					this.sourceInput?.setValue(path);
				}).open();
			}),
		);

		new Setting(this.contentEl).setName('Краткая заметка').addTextArea(
			(area) => {
				area.setPlaceholder('Пара слов о содержании')
					.setValue(this.values['description'] ?? '')
					.onChange((value) => {
						this.values['description'] = value;
					});
			},
		);

		this.coverSettingHost = this.contentEl.createDiv();
		this.renderCoverSetting();

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.editingItem ? 'Сохранить' : 'Создать')
					.setCta()
					.onClick(() => void this.submit()),
			);
	}

	private renderCoverSetting(): void {
		const host = this.coverSettingHost;
		if (!host) return;
		host.empty();
		const coverSetting = new Setting(host).setName('Обложка (необязательно)');
		if (this.coverPath) {
			coverSetting.setDesc(this.coverPath);
		}
		coverSetting.addButton((button) =>
			button.setButtonText('Файл').onClick(() => {
				new CoverSuggestModal(this.app, (path) => {
					this.coverPath = path;
					this.renderCoverSetting();
				}).open();
			}),
		);
		coverSetting.addButton((button) =>
			button.setButtonText('Ссылка').onClick(() => {
				new CoverUrlModal(this.app, (url) => {
					this.coverPath = url;
					this.renderCoverSetting();
				}).open();
			}),
		);
		if (this.coverPath) {
			coverSetting.addButton((button) =>
				button.setButtonText('Убрать').onClick(() => {
					this.coverPath = null;
					this.renderCoverSetting();
				}),
			);
		}
	}

	/** Ищет карточку того же типа с совпадающим названием ( без учёта регистра ). */
	private findDuplicate(
		title: string,
		type: ContentTypeId,
	): ContentItem | null {
		const needle = title.toLowerCase();
		return (
			this.plugin.index.getAll().find(
				(item) =>
					item.type === type &&
					item.title.toLowerCase() === needle &&
					item.file.path !== this.editingItem?.file.path,
			) ?? null
		);
	}

	private async submit(): Promise<void> {
		const type = this.selected;
		if (!type) return;
		const schema = getTypeSchema(type);
		if (!schema) return;

		const title = (this.values['title'] ?? '').trim();
		if (!title) {
			new Notice('Введите название');
			return;
		}

		const duplicate = this.findDuplicate(title, type);
		if (duplicate && !this.duplicateConfirmed) {
			const editing = this.editingItem !== null;
			new ConfirmModal(this.app, {
				title: 'Возможный дубликат',
				message: `«${duplicate.title}» — ${schema.label.toLowerCase()} с таким названием уже есть. ${editing ? 'Сохранить изменения?' : 'Создать ещё одну карточку?'}`,
				confirmText: editing ? 'Всё равно сохранить' : 'Всё равно создать',
				onConfirm: () => {
					this.duplicateConfirmed = true;
					void this.submit();
				},
			}).open();
			return;
		}
		this.duplicateConfirmed = false;

		const fields: Record<string, string | number> = {};
		for (const field of schema.fields) {
			const raw = (this.values[field.key] ?? '').trim();
			if (!raw) continue;
			if (field.kind === 'number') {
				const num = Number(raw);
				if (!Number.isFinite(num) || num < 0) {
					new Notice(`«${field.label}» — введите корректное число`);
					return;
				}
				fields[field.key] = num;
			} else {
				fields[field.key] = raw;
			}
		}

		try {
			if (this.editingItem) {
				await writeContentCard(this.app, this.editingItem, {
					title,
					status: this.status,
					fields,
					cover: this.coverPath,
					source: (this.values['source'] ?? '').trim() || null,
					description:
						(this.values['description'] ?? '').trim() || null,
				});
				this.close();
				return;
			}
			const file = await createContentItem(
				this.app,
				this.plugin.settings.rootFolder,
				{
					type,
					title,
					status: this.status,
					fields,
					cover: this.coverPath,
					source: (this.values['source'] ?? '').trim() || null,
					description:
						(this.values['description'] ?? '').trim() || null,
				},
			);
			if (file) {
				this.close();
				await this.app.workspace.getLeaf('tab').openFile(file);
			}
		} catch (error) {
			new Notice(
				this.editingItem
					? 'Не удалось обновить карточку'
					: 'Не удалось создать контент',
			);
			console.error(
				`content-log: ${this.editingItem ? 'edit' : 'create'} failed`,
				error,
			);
		}
	}
}

/** Явная точка входа в ту же форму для существующей карточки. */
export class EditContentModal extends AddContentModal {
	constructor(app: App, plugin: ContentLogPlugin, item: ContentItem) {
		super(app, plugin, item);
	}
}
