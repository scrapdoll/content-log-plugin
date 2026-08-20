import { Modal, Notice, Setting, type ButtonComponent } from 'obsidian';
import type ContentLogPlugin from '../main';
import { type HltbGame, searchHowLongToBeat } from '../core/hltb';
import { formatHours } from '../utils/format';

/**
 * Модалка поиска игры на howlongtobeat.com: строка запроса и список
 * результатов с временами прохождения; клик по строке применяет данные.
 */
export class HltbSearchModal extends Modal {
	private initialQuery: string;

	constructor(
		private plugin: ContentLogPlugin,
		initialQuery: string,
		private onPick: (game: HltbGame) => void,
	) {
		super(plugin.app);
		this.initialQuery = initialQuery;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		// addClass проксирует в classList.add — токен с пробелом бросает DOMException.
		contentEl.addClass('content-log-modal');
		contentEl.addClass('cl-hltb-modal');
		this.titleEl.setText('Поиск игры на howlongtobeat.com');

		const searchRow = contentEl.createDiv({ cls: 'cl-hltb-search' });
		const input = searchRow.createEl('input', {
			cls: 'cl-text-input cl-hltb-input',
			attr: {
				type: 'text',
				placeholder: 'Название игры ( латиницей )',
			},
		});
		input.value = this.initialQuery;

		const results = contentEl.createDiv({ cls: 'cl-hltb-results' });
		let busy = false;
		let searchButton: ButtonComponent | null = null;

		const runSearch = async (): Promise<void> => {
			const query = input.value.trim();
			if (!query || busy) return;
			busy = true;
			searchButton?.setDisabled(true).setButtonText('Поиск…');
			results.empty();
			results.createDiv({
				cls: 'cl-hltb-status is-busy',
				text: 'Идёт поиск на howlongtobeat.com…',
			});
			try {
				const games = await searchHowLongToBeat(query);
				results.empty();
				if (games.length === 0) {
					results.createDiv({
						cls: 'cl-hltb-status',
						text: /[\u0400-\u04FF]/.test(query)
							? 'Ничего не найдено — howlongtobeat.com ищет по английским названиям, введите название латиницей'
							: 'Ничего не найдено',
					});
					return;
				}
				for (const game of games) {
					this.renderResult(results, game);
				}
			} catch (error) {
				results.empty();
				const reason = error instanceof Error ? error.message : String(error);
				results.createDiv({
					cls: 'cl-hltb-status cl-hltb-status--error',
					text: `Поиск не удался: ${reason}`,
				});
				new Notice(`Поиск на howlongtobeat.com не удался: ${reason}`);
				console.error('content-log: hltb search failed', error);
			} finally {
				busy = false;
				searchButton?.setDisabled(false).setButtonText('Найти');
			}
		};

		input.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter') {
				evt.preventDefault();
				void runSearch();
			}
		});
		new Setting(searchRow).addButton((button) => {
			searchButton = button;
			button.setButtonText('Найти').onClick(() => void runSearch());
		});

		if (this.initialQuery.trim()) {
			void runSearch();
		}
		contentEl.createDiv({
			cls: 'cl-hltb-hint',
			text: `Запрос уходит на howlongtobeat.com только при нажатии «Найти» ( v${this.plugin.manifest.version} )`,
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderResult(container: HTMLElement, game: HltbGame): void {
		const row = container.createDiv({ cls: 'cl-hltb-result' });
		row.addEventListener('click', () => {
			this.onPick(game);
			this.close();
		});
		row.createEl('img', {
			cls: 'cl-hltb-result-cover',
			attr: {
				src: game.imageUrl,
				alt: game.name,
				loading: 'lazy',
			},
		});
		const main = row.createDiv({ cls: 'cl-hltb-result-main' });
		main.createDiv({ cls: 'cl-hltb-result-name', text: game.name });
		const meta: string[] = [];
		if (game.platforms) meta.push(game.platforms);
		if (game.year !== null) meta.push(String(game.year));
		if (meta.length > 0) {
			main.createDiv({
				cls: 'cl-hltb-result-meta',
				text: meta.join(' · '),
			});
		}
		const times = row.createDiv({ cls: 'cl-hltb-result-times' });
		const time = (label: string, hours: number | null): void => {
			const cell = times.createDiv({ cls: 'cl-hltb-result-time' });
			cell.createSpan({ cls: 'cl-hltb-label', text: label });
			cell.createSpan({ cls: 'cl-hltb-value', text: formatHours(hours) });
		};
		time('Сюжет', game.mainHours);
		time('+ доп.', game.extraHours);
		time('100%', game.completeHours);
	}
}
