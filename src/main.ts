import { Plugin } from 'obsidian';
import {
	ContentLogSettingTab,
	ContentLogSettings,
	normalizeSettings,
} from './settings';
import { rebuildTypeRegistry } from './core/registry';
import { ContentIndex } from './core/index';
import { registerCommands } from './commands';
import {
	ContentDashboardView,
	openDashboard,
	VIEW_TYPE_CONTENT_DASHBOARD,
} from './ui/dashboard-view';
import { registerCardHeader } from './ui/card-header';
import { registerLivePreviewHeader } from './ui/card-header-live';
import { MetadataProviderRegistry } from './core/metadata-provider-registry';
import { MetadataService } from './core/metadata-service';
import { TmdbMetadataProvider } from './integrations/tmdb/tmdb-provider';
import { TMDB_ATTRIBUTION } from './ui/tmdb-attribution';

export default class ContentLogPlugin extends Plugin {
	settings!: ContentLogSettings;
	index!: ContentIndex;
	metadataProviders!: MetadataProviderRegistry;
	metadataService!: MetadataService;

	async onload(): Promise<void> {
		this.metadataProviders = new MetadataProviderRegistry([
			new TmdbMetadataProvider(TMDB_ATTRIBUTION),
		]);
		this.metadataService = new MetadataService(
			this.metadataProviders,
			(secretName) => this.app.secretStorage.getSecret(secretName),
		);
		await this.loadSettings();
		rebuildTypeRegistry(
			this.settings.customTypes,
			this.settings.customStatuses,
		);

		this.index = new ContentIndex(this);
		this.registerView(
			VIEW_TYPE_CONTENT_DASHBOARD,
			(leaf) => new ContentDashboardView(leaf, this),
		);
		registerCommands(this);
		registerCardHeader(this);
		registerLivePreviewHeader(this);
		this.addRibbonIcon('library', 'Открыть дашборд', () => {
			void openDashboard(this);
		});
		this.addSettingTab(new ContentLogSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.index.init());
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
