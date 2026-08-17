import { App, debounce, PluginSettingTab, Setting } from 'obsidian';
import type ContentLogPlugin from './main';
import { getAllTypeSchemas, rebuildTypeRegistry } from './core/registry';
import type { TypeSchema } from './types';
import { CustomTypeModal } from './ui/custom-type-modal';

export interface ContentLogSettings {
	/** Корневая папка контента в vault, например «Content Log». */
	rootFolder: string;
	/** Пользовательские типы контента. */
	customTypes: TypeSchema[];
}

export const DEFAULT_SETTINGS: ContentLogSettings = {
	rootFolder: 'Content Log',
	customTypes: [],
};

export class ContentLogSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ContentLogPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Корневая папка')
			.setDesc('Папка в vault, где плагин хранит карточки контента и заметки.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.rootFolder)
					.setValue(this.plugin.settings.rootFolder)
					.onChange(
						debounce(async (value: string) => {
							this.plugin.settings.rootFolder =
								value.trim() || DEFAULT_SETTINGS.rootFolder;
							await this.plugin.saveSettings();
							this.plugin.index.rebuild();
						}, 500, true),
					),
			);

		new Setting(containerEl)
			.setName('Кастомные типы контента')
			.setDesc(
				'Свои типы (подкасты, сериалы, курсы) с полями и прогрессом. Удаление типа не удаляет созданные заметки.',
			)
			.setHeading();

		const custom = this.plugin.settings.customTypes;
		if (custom.length === 0) {
			containerEl.createEl('p', {
				cls: 'setting-item-description',
				text: 'Кастомных типов пока нет.',
			});
		}
		for (const schema of custom) {
			new Setting(containerEl)
				.setName(schema.label)
				.setDesc(`Ключ: ${schema.id} · папка: ${schema.folder}`)
				.addButton((button) =>
					button.setButtonText('Изменить').onClick(() => {
						this.openTypeModal(schema);
					}),
				)
				.addButton((button) =>
					button.setButtonText('Удалить').onClick(() => {
						void this.removeType(schema.id);
					}),
				);
		}

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText('Добавить тип')
				.setCta()
				.onClick(() => this.openTypeModal(null)),
		);
	}

	private openTypeModal(initial: TypeSchema | null): void {
		const existingIds = getAllTypeSchemas()
			.map((schema) => schema.id)
			.filter((id) => id !== initial?.id);
		new CustomTypeModal(this.app, {
			initial,
			existingIds,
			onSave: async (schema) => {
				const list = this.plugin.settings.customTypes;
				const index = list.findIndex((t) => t.id === schema.id);
				if (index >= 0) {
					list[index] = schema;
				} else {
					list.push(schema);
				}
				await this.applyTypesChange();
			},
		}).open();
	}

	private async removeType(id: string): Promise<void> {
		this.plugin.settings.customTypes =
			this.plugin.settings.customTypes.filter((t) => t.id !== id);
		await this.applyTypesChange();
	}

	private async applyTypesChange(): Promise<void> {
		await this.plugin.saveSettings();
		rebuildTypeRegistry(this.plugin.settings.customTypes);
		this.plugin.index.rebuild();
		this.display();
	}
}
