import {
	Modal,
	Notice,
	Setting,
	type App,
	type ButtonComponent,
} from 'obsidian';
import type {
	MediaMetadataDetails,
	MediaMetadataKind,
	MediaMetadataProvider,
	MediaMetadataSearchResult,
} from '../core/metadata-provider';
import { MetadataService } from '../core/metadata-service';
import { renderProviderAttribution } from './provider-attribution';

export interface MetadataSearchModalOptions {
	provider: MediaMetadataProvider;
	kind: MediaMetadataKind;
	secretName: string | undefined;
	initialQuery: string;
	onPick: (details: MediaMetadataDetails) => void;
}

/** Поисковый UI не зависит от протокола и формата ответа конкретного каталога. */
export class MetadataSearchModal extends Modal {
	constructor(
		app: App,
		private service: MetadataService,
		private options: MetadataSearchModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('content-log-modal');
		contentEl.addClass('cl-metadata-modal');
		this.titleEl.setText(`Поиск через ${this.options.provider.info.label}`);

		const searchRow = contentEl.createDiv({ cls: 'cl-metadata-search' });
		const input = searchRow.createEl('input', {
			cls: 'cl-text-input cl-metadata-input',
			attr: { type: 'text', placeholder: 'Название' },
		});
		input.value = this.options.initialQuery;
		const results = contentEl.createDiv({ cls: 'cl-metadata-results' });
		let busy = false;
		let searchButton: ButtonComponent | null = null;

		const runSearch = async (): Promise<void> => {
			const query = input.value.trim();
			if (!query || busy) return;
			busy = true;
			searchButton?.setDisabled(true).setButtonText('Поиск…');
			this.renderStatus(results, 'Идёт поиск…');
			try {
				const items = await this.service.search(
					this.options.kind,
					this.options.provider.info.id,
					this.options.secretName,
					query,
				);
				results.empty();
				if (items.length === 0) {
					this.renderStatus(results, 'Ничего не найдено');
					return;
				}
				for (const item of items) this.renderResult(results, item);
			} catch (error) {
				this.reportError(results, 'Поиск не удался', error);
			} finally {
				busy = false;
				searchButton?.setDisabled(false).setButtonText('Найти');
			}
		};

		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void runSearch();
			}
		});
		new Setting(searchRow).addButton((button) => {
			searchButton = button;
			button.setButtonText('Найти').onClick(() => void runSearch());
		});
		if (this.options.initialQuery.trim()) void runSearch();

		contentEl.createDiv({
			cls: 'cl-metadata-hint',
			text: `Запрос и изображения загружаются через ${this.options.provider.info.label}.`,
		});
		renderProviderAttribution(
			contentEl,
			this.options.provider.info.attribution,
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderResult(
		container: HTMLElement,
		item: MediaMetadataSearchResult,
	): void {
		const row = container.createDiv({ cls: 'cl-metadata-result' });
		row.addEventListener('click', () => void this.pickResult(container, item));
		if (item.posterUrl) {
			row.createEl('img', {
				cls: 'cl-metadata-result-cover',
				attr: { src: item.posterUrl, alt: item.title, loading: 'lazy' },
			});
		} else {
			row.createDiv({
				cls: 'cl-metadata-result-cover is-empty',
				text: this.options.provider.info.label,
			});
		}
		const main = row.createDiv({ cls: 'cl-metadata-result-main' });
		main.createDiv({ cls: 'cl-metadata-result-name', text: item.title });
		const meta = [
			item.year !== null ? String(item.year) : '',
			item.originalTitle !== item.title ? item.originalTitle : '',
			item.rating !== null ? `★ ${item.rating}` : '',
		].filter(Boolean);
		if (meta.length > 0) {
			main.createDiv({
				cls: 'cl-metadata-result-meta',
				text: meta.join(' · '),
			});
		}
		if (item.overview) {
			main.createDiv({
				cls: 'cl-metadata-result-overview',
				text: item.overview,
			});
		}
	}

	private async pickResult(
		container: HTMLElement,
		item: MediaMetadataSearchResult,
	): Promise<void> {
		this.renderStatus(container, 'Загружаю подробные данные…');
		try {
			const details = await this.service.getDetails(
				item,
				this.options.secretName,
			);
			this.options.onPick(details);
			this.close();
		} catch (error) {
			this.reportError(container, 'Не удалось загрузить данные', error);
		}
	}

	private renderStatus(
		container: HTMLElement,
		message: string,
		error = false,
	): void {
		container.empty();
		container.createDiv({
			cls: `cl-metadata-status${error ? ' cl-metadata-status--error' : ''}`,
			text: message,
		});
	}

	private reportError(
		container: HTMLElement,
		prefix: string,
		error: unknown,
	): void {
		const reason = error instanceof Error ? error.message : String(error);
		this.renderStatus(container, `${prefix}: ${reason}`, true);
		new Notice(`${prefix}: ${reason}`);
		console.error('content-log: metadata request failed', error);
	}
}
