import { Menu, setIcon } from 'obsidian';
import { openProgressModal } from '../commands/progress';
import { RateContentModal } from '../commands/rating';
import {
	writeHltb,
	writeProgress,
	writeProgressTotal,
} from '../core/mutations';
import { getTypeSchema } from '../core/registry';
import type ContentLogPlugin from '../main';
import type { ContentItem } from '../types';
import { progressText } from '../utils/helpers';
import { createCardActionRunner } from './action-errors';
import {
	addCoverActions,
	addNoteActions,
	addSourceActions,
} from './card-secondary-actions';
import { HltbSearchModal } from './hltb-search-modal';
import { NumberInputModal } from './number-input-modal';

/** Меню «⋯» со всеми действиями над карточкой. */
export function buildCardActionsMenu(
	plugin: ContentLogPlugin,
	panel: HTMLElement,
	item: ContentItem,
	refresh: () => void,
): void {
	const schema = getTypeSchema(item.type);
	const run = createCardActionRunner(refresh);
	const button = panel.createEl('button', {
		cls: 'cl-chip-button cl-card-more',
		attr: { 'aria-label': 'Действия' },
	});
	setIcon(button, 'more-horizontal');
	button.addEventListener('click', (event) => {
		const menu = new Menu();

		if (schema?.progressField) {
			for (const step of schema.progressQuickSteps) {
				menu.addItem((menuItem) =>
					menuItem
						.setTitle(`Прибавить +${step} ${schema.progressUnit}`)
						.setIcon('plus')
						.setSection('progress')
						.onClick(() =>
							run(
								'progress update',
								writeProgress(
									plugin.app,
									item,
									(item.progress.current ?? 0) + step,
								),
								'Не удалось обновить прогресс',
							),
						),
				);
			}
			menu.addItem((menuItem) =>
				menuItem
					.setTitle('Задать точный прогресс…')
					.setIcon('pencil')
					.setSection('progress')
					.onClick(() => openProgressModal(plugin.app, item, refresh)),
			);
		}

		if (schema?.progressTotalField) {
			const totalField = schema.fields.find(
				(field) => field.key === schema.progressTotalField,
			);
			menu.addItem((menuItem) =>
				menuItem
					.setTitle(`${totalField?.label ?? 'Общее количество'}…`)
					.setIcon('pencil')
					.setSection('progress')
					.onClick(() => {
						new NumberInputModal(plugin.app, {
							title: `${totalField?.label ?? 'Общее количество'} — ${item.title}`,
							value: item.progress.total,
							minimum: 0,
							zeroIsEmpty: true,
							placeholder: totalField?.placeholder ?? '',
							hint: `Сейчас: ${progressText(item)}. Пустое поле убирает значение.`,
							onSave: (value) =>
								run(
									'progress total update',
									writeProgressTotal(plugin.app, item, value),
									'Не удалось обновить общее количество',
								),
						}).open();
					}),
			);
		}

		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Оценить…')
				.setIcon('star')
				.setSection('rating')
				.onClick(() => new RateContentModal(plugin.app, item, refresh).open()),
		);

		if (item.type === 'game') {
			menu.addItem((menuItem) =>
				menuItem
					.setTitle('Найти на howlongtobeat.com…')
					.setIcon('gamepad-2')
					.setSection('hltb')
					.onClick(() => {
						new HltbSearchModal(plugin, item.title, (game) => {
							run(
								'hltb update',
								writeHltb(plugin.app, item, game),
								'Не удалось записать данные HowLongToBeat',
							);
						}).open();
					}),
			);
		}

		addCoverActions(menu, plugin, item, run);
		addSourceActions(menu, plugin, item, refresh, run);
		addNoteActions(menu, plugin, item, run);
		menu.showAtMouseEvent(event);
	});
}
