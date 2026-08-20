import { Plugin } from 'obsidian';
import {
	ContentLogSettingTab,
	ContentLogSettings,
	DEFAULT_SETTINGS,
} from './settings';
import { rebuildTypeRegistry } from './core/registry';
import { normalizeTypeSchemas } from './core/type-schema';
import { BUILTIN_TYPES } from './types';
import { ContentIndex } from './core/index';
import { registerCommands } from './commands';
import {
	ContentDashboardView,
	openDashboard,
	VIEW_TYPE_CONTENT_DASHBOARD,
} from './ui/dashboard-view';
import { registerCardHeader } from './ui/card-header';
import { registerLivePreviewHeader } from './ui/card-header-live';

export default class ContentLogPlugin extends Plugin {
	settings!: ContentLogSettings;
	index!: ContentIndex;

	async onload(): Promise<void> {
		await this.loadSettings();
		rebuildTypeRegistry(this.settings.customTypes);

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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ContentLogSettings>,
		);
		this.settings.customTypes = normalizeTypeSchemas(
			this.settings.customTypes,
			BUILTIN_TYPES.map((schema) => schema.id),
		);
		this.settings.sourceOpenByExtension =
			typeof this.settings.sourceOpenByExtension === 'object' &&
			this.settings.sourceOpenByExtension !== null
				? { ...this.settings.sourceOpenByExtension }
				: {};
		const mode = this.settings.sourceOpenMode;
		this.settings.sourceOpenMode =
			mode === 'tab' || mode === 'system' ? mode : 'auto';
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
