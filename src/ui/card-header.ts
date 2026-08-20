import { Menu, setIcon, TFile } from 'obsidian';
import type ContentLogPlugin from '../main';
import {
	contentItemFromFrontmatter,
	parseContentItem,
} from '../core/content-item';
import { frontmatterRepository } from '../core/frontmatter';
import {
	writeStatus,
	writeHltb,
} from '../core/mutations';
import { resolveCoverSrc } from '../core/cover';
import { hltbGameUrl } from '../core/hltb';
import { formatHours } from '../utils/format';
import { getTypeSchema, isKnownType } from '../core/registry';
import { RateContentModal } from '../commands/rating';
import {
	STATUSES,
	type ContentItem,
	statusLabel,
} from '../types';
import {
	progressPercent,
	progressText,
} from '../utils/helpers';
import { HltbSearchModal } from './hltb-search-modal';
import { appendSourceChip } from './source-chip';
import { createCardActionRunner } from './action-errors';
import { buildCardActionsMenu } from './card-actions-menu';
import { buildCardNotesSection } from './card-notes';

/**
 * Интерактивная шапка карточки: обложка, статус, прогресс и список
 * заметок. Все действия скрыты в меню «⋯». Используется в reading view
 * ( post processor ) и в live preview ( CM6 widget ).
 */

interface CardMount {
	file: TFile;
	plugin: ContentLogPlugin;
}

/** Живые шапки: контейнер → карточка, для обновления по событию индекса. */
const activeMounts = new Map<HTMLElement, CardMount>();

export function registerCardHeader(plugin: ContentLogPlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const fm = ctx.frontmatter as Record<string, unknown> | undefined;
		const type = fm?.['type'];
		if (!isKnownType(type)) return;

		// Шапку размещаем в секции с заголовком карточки.
		const h1 = el.querySelector('h1');
		if (!h1) return;

		const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;
		const item =
			plugin.index.get(file) ?? parseContentItem(plugin.app, file);
		if (!item) return;

		// Отдельный контейнер, чтобы перерисовывать панель после записей.
		const mount = el.createDiv();
		buildCardHeaderPanel(plugin, mount, item);
	});

	// Заметки и обложки меняются без правки карточки — обновляем шапки
	// при любом изменении индекса ( он слушает весь корень плагина ).
	plugin.registerEvent(
		plugin.index.on('changed', () => {
			for (const [container, info] of [...activeMounts]) {
				if (!container.isConnected) {
					activeMounts.delete(container);
					continue;
				}
				void rerenderPanel(info.plugin, container, info.file);
			}
		}),
	);
}

/** Строит панель шапки в переданный контейнер. */
export function buildCardHeaderPanel(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	item: ContentItem,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema) return;

	activeMounts.set(container, { file: item.file, plugin });

	const panel = container.createDiv({ cls: 'cl-card-header' });
	const refresh = () => void rerenderPanel(plugin, container, item.file);

	const coverSrc = resolveCoverSrc(plugin.app, item);
	if (coverSrc) {
		panel.createEl('img', {
			cls: 'cl-card-cover',
			attr: {
				src: coverSrc,
				alt: item.title,
				loading: 'lazy',
			},
		});
	}

	const info = panel.createDiv({ cls: 'cl-card-info' });
	const row = info.createDiv({ cls: 'cl-card-info-row' });
	buildStatusPill(plugin, row, item, refresh);
	if (schema.progressField) {
		buildProgressDisplay(row, item);
	}
	if (item.rating !== null) {
		buildRatingDisplay(plugin, row, item, refresh);
	}
	buildHltbDisplay(plugin, info, item, refresh);
	appendSourceChip(plugin, info, item);
	if (item.description) {
		info.createDiv({
			cls: 'cl-card-desc',
			text: item.description,
			attr: { title: item.description },
		});
	}

	buildCardActionsMenu(plugin, panel, item, refresh);
	buildCardNotesSection(plugin, panel, item);
}

/**
 * Перечитывает карточку с диска и строит панель заново: Obsidian не
 * перезапускает post processor при изменении только frontmatter.
 */
async function rerenderPanel(
	plugin: ContentLogPlugin,
	container: HTMLElement,
	file: TFile,
): Promise<void> {
	const fm = await frontmatterRepository(plugin.app).read(file);
	if (!fm) return;
	const item = contentItemFromFrontmatter(file, fm);
	if (!item) return;
	container.empty();
	buildCardHeaderPanel(plugin, container, item);
}

function buildStatusPill(
	plugin: ContentLogPlugin,
	row: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const run = createCardActionRunner(refresh);
	const statusPill = row.createDiv({
		cls: `cl-status cl-status--${item.status} cl-card-status`,
		text: statusLabel(item.status),
	});
	statusPill.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const status of STATUSES) {
			menu.addItem((menuItem) =>
				menuItem
					.setTitle(status.label)
					.setChecked(status.id === item.status)
					.onClick(() =>
						run(
							'status update',
							writeStatus(plugin.app, item, status.id),
							'Не удалось обновить статус',
						),
					),
			);
		}
		menu.showAtMouseEvent(evt);
	});
}

function buildProgressDisplay(row: HTMLElement, item: ContentItem): void {
	if (item.progress.total) {
		const bar = row.createDiv({ cls: 'cl-progress' });
		const fill = bar.createDiv({ cls: 'cl-progress-fill' });
		fill.style.width = `${progressPercent(item)}%`;
	}
	row.createSpan({
		cls: 'cl-card-progress-label',
		text: progressText(item),
	});
}

function buildRatingDisplay(
	plugin: ContentLogPlugin,
	row: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const rating = item.rating ?? 0;
	const stars = row.createEl('button', {
		cls: 'cl-card-rating',
		text: '★'.repeat(rating) + '☆'.repeat(5 - rating),
		attr: { 'aria-label': 'Изменить оценку' },
	});
	stars.addEventListener('click', () => {
		new RateContentModal(plugin.app, item, refresh).open();
	});
}

/**
 * Виджет HowLongToBeat: времена прохождения и ссылка на страницу игры.
 * Пока данных нет, для игр вместо виджета показывается кнопка генерации.
 */
function buildHltbDisplay(
	plugin: ContentLogPlugin,
	info: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const run = createCardActionRunner(refresh);
	const hltb = item.hltb;
	if (!hltb) {
		if (item.type !== 'game') return;
		const button = info.createEl('button', {
			cls: 'cl-chip-button cl-hltb-generate',
			attr: { 'aria-label': 'Найти данные игры на howlongtobeat.com' },
		});
		setIcon(button, 'gamepad-2');
		button.createSpan({ text: 'Заполнить из howlongtobeat.com…' });
		button.addEventListener('click', () => {
			new HltbSearchModal(plugin, item.title, (game) => {
				run(
					'hltb update',
					writeHltb(plugin.app, item, game),
					'Не удалось записать данные HowLongToBeat',
				);
			}).open();
		});
		return;
	}

	const block = info.createDiv({ cls: 'cl-hltb' });
	const cell = (label: string, hours: number | null): void => {
		const element = block.createDiv({ cls: 'cl-hltb-cell' });
		element.createSpan({ cls: 'cl-hltb-label', text: label });
		element.createSpan({ cls: 'cl-hltb-value', text: formatHours(hours) });
	};
	cell('Сюжет', hltb.main);
	cell('+ дополнения', hltb.extra);
	cell('100%', hltb.complete);
	if (hltb.id !== null) {
		block.createEl('a', {
			cls: 'cl-hltb-link',
			text: 'Открыть на howlongtobeat.com',
			attr: {
				href: hltbGameUrl(hltb.id),
				target: '_blank',
				rel: 'noopener',
				title: 'Страница игры',
			},
		});
	}
}
