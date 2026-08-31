import {
	App,
	debounce,
	PluginSettingTab,
	Setting,
} from 'obsidian';
import type ContentLogPlugin from './main';
import { getAllTypeSchemas, rebuildTypeRegistry } from './core/registry';
import {
	SOURCE_EXTENSIONS,
	type SourceExtensionMode,
	type SourceOpenMode,
} from './core/source';
import type { TypeSchema } from './types';
import { BUILTIN_TYPES } from './types';
import { normalizeTypeSchemas } from './core/type-schema';
import { isRecord } from './utils/guards';
import { CustomTypeModal } from './ui/custom-type-modal';
import type {
	MediaMetadataKind,
	MetadataProviderSettings,
} from './core/metadata-provider';
import { renderProviderSettings } from './settings/provider-settings';

export interface ContentLogSettings {
	/** Корневая папка контента в vault, например «Content Log». */
	rootFolder: string;
	/** Как открывать файлы-источники: авто, вкладка или системное приложение. */
	sourceOpenMode: SourceOpenMode;
	/** Отдельный режим открытия по расширению ( epub, fb2, mobi ). */
	sourceOpenByExtension: Record<string, SourceExtensionMode>;
	/** Пользовательские типы контента. */
	customTypes: TypeSchema[];
	/** Выбранные реализации и ссылки на секреты внешних каталогов. */
	metadataProviders: MetadataProviderSettings;
}

export const DEFAULT_SETTINGS: ContentLogSettings = {
	rootFolder: 'Content Log',
	sourceOpenMode: 'auto',
	sourceOpenByExtension: {},
	customTypes: [],
	metadataProviders: { selectedByKind: {}, secretNames: {} },
};

export function normalizeSettings(value: unknown): ContentLogSettings {
	const raw = isRecord(value) ? value : {};
	const mode = raw['sourceOpenMode'];
	const sourceOpenMode: SourceOpenMode =
		mode === 'tab' || mode === 'system' ? mode : 'auto';
	const sourceOpenByExtension: Record<string, SourceExtensionMode> = {};
	const extensions = raw['sourceOpenByExtension'];
	if (isRecord(extensions)) {
		for (const extension of SOURCE_EXTENSIONS) {
			const extensionMode = extensions[extension];
			if (extensionMode === 'tab' || extensionMode === 'system') {
				sourceOpenByExtension[extension] = extensionMode;
			}
		}
	}
	const rootFolder =
		typeof raw['rootFolder'] === 'string' && raw['rootFolder'].trim()
			? raw['rootFolder'].trim()
			: DEFAULT_SETTINGS.rootFolder;
	return {
		rootFolder,
		sourceOpenMode,
		sourceOpenByExtension,
		customTypes: normalizeTypeSchemas(
			raw['customTypes'],
			BUILTIN_TYPES.map((schema) => schema.id),
		),
		metadataProviders: normalizeMetadataProviderSettings(raw),
	};
}

export class ContentLogSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ContentLogPlugin) {
		super(app, plugin);
	}

	display(): void {
		this.renderSettings();
	}

	private renderSettings(): void {
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

		const group = containerEl.createDiv({ cls: 'cl-settings-group' });

		new Setting(group)
			.setName('Открытие файлов-источников')
			.setDesc(
				'Авто — вкладкой для форматов, которые Obsidian сам отображает ( PDF, картинки, медиа ), остальные — в системном приложении.',
			)
			.addDropdown((drop) => {
				drop.addOption('auto', 'Авто')
					.addOption('tab', 'Вкладкой в Obsidian')
					.addOption('system', 'В приложении по умолчанию')
					.setValue(this.plugin.settings.sourceOpenMode)
					.onChange(async (value) => {
						this.plugin.settings.sourceOpenMode =
							value === 'tab' || value === 'system'
								? value
								: 'auto';
						await this.plugin.saveSettings();
					});
			});

		const extensions = group.createEl('details');
		extensions.createEl('summary', {
			text: 'Отдельные режимы ( epub, fb2, mobi, azw3 )',
		});

		for (const ext of SOURCE_EXTENSIONS) {
			new Setting(extensions)
				.setName(ext.toUpperCase())
				.addDropdown((drop) => {
					drop.addOption('default', 'Общая настройка')
						.addOption('tab', 'Вкладкой в Obsidian')
						.addOption('system', 'В приложении по умолчанию')
						.setValue(
							this.plugin.settings.sourceOpenByExtension[ext] ??
								'default',
						)
						.onChange(async (value) => {
							if (value === 'default') {
								delete this.plugin.settings
									.sourceOpenByExtension[ext];
							} else {
								this.plugin.settings.sourceOpenByExtension[ext] =
									value as SourceExtensionMode;
							}
							await this.plugin.saveSettings();
						});
				});
		}

		const providers = containerEl.createEl('details', {
			cls: 'cl-settings-panel',
		});
		providers.createEl('summary', {
			text: 'Провайдеры',
			attr: {
				'aria-label': 'Показать или скрыть настройки провайдеров',
			},
		});
		renderProviderSettings(
			this.app,
			this.plugin,
			providers.createDiv({ cls: 'cl-settings-panel-content' }),
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
		this.renderSettings();
	}
}

const METADATA_KINDS: MediaMetadataKind[] = ['movie', 'series', 'anime'];

function normalizeMetadataProviderSettings(
	rawSettings: Record<string, unknown>,
): MetadataProviderSettings {
	const raw = isRecord(rawSettings['metadataProviders'])
		? rawSettings['metadataProviders']
		: {};
	const selectedByKind: MetadataProviderSettings['selectedByKind'] = {};
	const selected = isRecord(raw['selectedByKind']) ? raw['selectedByKind'] : {};
	for (const kind of METADATA_KINDS) {
		const id = selected[kind];
		if (typeof id === 'string' && id.trim()) selectedByKind[kind] = id.trim();
	}
	const secretNames: Record<string, string> = {};
	const secrets = isRecord(raw['secretNames']) ? raw['secretNames'] : {};
	for (const [providerId, value] of Object.entries(secrets)) {
		if (typeof value === 'string' && value.trim()) {
			secretNames[providerId] = value.trim();
		}
	}
	const legacyTmdbSecret = rawSettings['tmdbSecretName'];
	if (
		!secretNames['tmdb'] &&
		typeof legacyTmdbSecret === 'string' &&
		legacyTmdbSecret.trim()
	) {
		secretNames['tmdb'] = legacyTmdbSecret.trim();
	}
	return { selectedByKind, secretNames };
}
