import type { App } from 'obsidian';
import { writeProgress } from '../core/mutations';
import { getTypeSchema } from '../core/registry';
import type { ContentItem } from '../types';
import { progressText } from '../utils/helpers';
import { runCardAction } from '../ui/action-errors';
import { NumberInputModal } from '../ui/number-input-modal';

/** Открывает общий числовой ввод с быстрыми шагами прогресса. */
export function openProgressModal(
	app: App,
	item: ContentItem,
	onSaved?: () => void,
): void {
	const schema = getTypeSchema(item.type);
	if (!schema?.progressField) return;
	const current = item.progress.current ?? 0;
	new NumberInputModal(app, {
		title: `Прогресс — ${item.title}`,
		value: current,
		placeholder: String(current),
		hint: `Сейчас: ${progressText(item)}. Поле задаёт новое значение, кнопки прибавляют.`,
		allowEmpty: false,
		minimum: 0,
		quickValues: schema.progressQuickSteps.map((step) => ({
			label: `+${step} ${schema.progressUnit}`,
			value: current + step,
		})),
		onSave: (value) => {
			runCardAction(
				'progress update',
				onSaved,
				writeProgress(app, item, value ?? current),
				'Не удалось обновить прогресс',
			);
		},
	}).open();
}
