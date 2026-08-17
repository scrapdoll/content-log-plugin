import type ContentLogPlugin from '../main';
import { getTypeSchema } from '../core/registry';
import { getActiveContentItem } from '../utils/helpers';
import { AddContentModal } from '../ui/add-content-modal';
import { openDashboard } from '../ui/dashboard-view';
import { UpdateProgressModal } from './progress';
import { UpdateStatusModal } from './status';
import { AddNoteModal } from './note';
import { RateContentModal } from './rating';
import { exportDashboardMarkdown } from './export';

export function registerCommands(plugin: ContentLogPlugin): void {
	plugin.addCommand({
		id: 'add-content',
		name: 'Добавить контент',
		callback: () => new AddContentModal(plugin.app, plugin).open(),
	});

	plugin.addCommand({
		id: 'open-dashboard',
		name: 'Открыть дашборд',
		callback: () => void openDashboard(plugin),
	});

	plugin.addCommand({
		id: 'update-progress',
		name: 'Обновить прогресс',
		checkCallback: (checking) => {
			const item = getActiveContentItem(plugin);
			if (!item || !getTypeSchema(item.type)?.progressField) return false;
			if (!checking) new UpdateProgressModal(plugin.app, item).open();
			return true;
		},
	});

	plugin.addCommand({
		id: 'update-status',
		name: 'Изменить статус',
		checkCallback: (checking) => {
			const item = getActiveContentItem(plugin);
			if (!item) return false;
			if (!checking) new UpdateStatusModal(plugin.app, item).open();
			return true;
		},
	});

	plugin.addCommand({
		id: 'add-note',
		name: 'Добавить заметку к контенту',
		checkCallback: (checking) => {
			const item = getActiveContentItem(plugin);
			if (!item) return false;
			if (!checking) new AddNoteModal(plugin.app, item).open();
			return true;
		},
	});

	plugin.addCommand({
		id: 'rate-content',
		name: 'Оценить контент',
		checkCallback: (checking) => {
			const item = getActiveContentItem(plugin);
			if (!item) return false;
			if (!checking) new RateContentModal(plugin.app, item).open();
			return true;
		},
	});

	plugin.addCommand({
		id: 'export-dashboard',
		name: 'Экспортировать дашборд в Markdown',
		callback: () => void exportDashboardMarkdown(plugin),
	});
}
