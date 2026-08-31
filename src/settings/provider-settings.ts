import { SecretComponent, Setting, type App } from 'obsidian';
import type { MediaMetadataKind } from '../core/metadata-provider';
import type ContentLogPlugin from '../main';
import { renderProviderAttribution } from '../ui/provider-attribution';

const PROVIDER_SELECTORS: Array<{
	kind: MediaMetadataKind;
	label: string;
}> = [
	{ kind: 'movie', label: 'Данные фильмов' },
	{ kind: 'series', label: 'Данные сериалов' },
	{ kind: 'anime', label: 'Данные аниме' },
];

/** Отдельное представление настроек внешних каталогов. */
export function renderProviderSettings(
	app: App,
	plugin: ContentLogPlugin,
	container: HTMLElement,
): void {
	new Setting(container)
		.setName('Провайдеры метаданных')
		.setDesc(
			'Выберите внешние каталоги и секреты для загрузки данных контента.',
		)
		.setHeading();

	for (const selector of PROVIDER_SELECTORS) {
		renderProviderSelector(plugin, container, selector.kind, selector.label);
	}

	for (const provider of plugin.metadataProviders.getAll()) {
		const credential = provider.info.credential;
		if (credential) {
			new Setting(container)
				.setName(credential.label)
				.setDesc(credential.description)
				.addComponent((element) =>
					new SecretComponent(app, element)
						.setValue(
							plugin.settings.metadataProviders.secretNames[
								provider.info.id
							] ?? '',
						)
						.onChange(async (value) => {
							const secrets =
								plugin.settings.metadataProviders.secretNames;
							if (value) secrets[provider.info.id] = value;
							else delete secrets[provider.info.id];
							await plugin.saveSettings();
						}),
				);
		}
		renderProviderAttribution(container, provider.info.attribution);
	}
}

function renderProviderSelector(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	kind: MediaMetadataKind,
	label: string,
): void {
	const providers = plugin.metadataProviders.getForKind(kind);
	const current = plugin.metadataProviders.resolve(
		kind,
		plugin.settings.metadataProviders.selectedByKind[kind],
	);
	new Setting(container)
		.setName(label)
		.setDesc('Новые источники появятся здесь после добавления адаптера.')
		.addDropdown((dropdown) => {
			for (const provider of providers) {
				dropdown.addOption(provider.info.id, provider.info.label);
			}
			dropdown.setValue(current?.info.id ?? '').onChange(async (value) => {
				plugin.settings.metadataProviders.selectedByKind[kind] = value;
				await plugin.saveSettings();
			});
		});
}
