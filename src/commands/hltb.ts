import type ContentLogPlugin from '../main';
import { writeHltb } from '../core/mutations';
import { HltbSearchModal } from '../ui/hltb-search-modal';
import { getActiveContentItem } from '../utils/helpers';

/**
 * Команда поиска данных игры на HowLongToBeat для открытой карточки.
 * Доступна только на карточках типа «Игра».
 */
export function registerHltbCommand(plugin: ContentLogPlugin): void {
	plugin.addCommand({
		id: 'hltb-lookup',
		name: 'Найти данные игры на howlongtobeat.com',
		checkCallback: (checking) => {
			const item = getActiveContentItem(plugin);
			if (!item || item.type !== 'game') return false;
			if (!checking) {
				new HltbSearchModal(plugin, item.title, (game) => {
					void writeHltb(plugin.app, item, game).catch((error) => {
						console.error('content-log: hltb update failed', error);
					});
				}).open();
			}
			return true;
		},
	});
}
