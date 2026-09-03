import { Setting, type App } from 'obsidian';
import type ContentLogPlugin from '../main';
import {
	getAllTypeSchemas,
	type ResolvedTypeSchema,
} from '../core/registry';
import { STATUSES, type StatusDef } from '../types';
import { StatusModal } from '../ui/status-modal';

/** Отдельное представление настроек статусов по типам контента. */
export function renderStatusSettings(
	app: App,
	plugin: ContentLogPlugin,
	container: HTMLElement,
	onChange: () => Promise<void>,
): void {
	new Setting(container)
		.setName('Статусы по типам контента')
		.setDesc(
			'Встроенные статусы есть у каждого типа и их список не меняется. Дополнительный статус — только метка: он не трогает даты и не участвует в автопереходах прогресса.',
		)
		.setHeading();

	for (const schema of getAllTypeSchemas()) {
		renderTypeStatuses(app, plugin, container, schema, onChange);
	}
}

function renderTypeStatuses(
	app: App,
	plugin: ContentLogPlugin,
	container: HTMLElement,
	schema: ResolvedTypeSchema,
	onChange: () => Promise<void>,
): void {
	const custom = plugin.settings.customStatuses[schema.id] ?? [];
	const block = container.createDiv({ cls: 'cl-status-settings-type' });

	new Setting(block).setName(schema.label).setDesc(
		`Встроенные: ${STATUSES.map((s) => s.label).join(', ')}`,
	);

	if (custom.length === 0) {
		block.createEl('p', {
			cls: 'setting-item-description',
			text: 'Дополнительных статусов нет.',
		});
	}
	for (const status of custom) {
		new Setting(block)
			.setName(status.label)
			.setDesc(`Ключ: ${status.id}`)
			.addButton((button) =>
				button.setButtonText('Изменить').onClick(() => {
					openStatusModal(app, plugin, schema.id, status, onChange);
				}),
			)
			.addButton((button) =>
				button.setButtonText('Удалить').onClick(() => {
					void removeStatus(plugin, schema.id, status.id, onChange);
				}),
			);
	}

	new Setting(block).addButton((button) =>
		button
			.setButtonText('Добавить статус')
			.onClick(() => openStatusModal(app, plugin, schema.id, null, onChange)),
	);
}

function openStatusModal(
	app: App,
	plugin: ContentLogPlugin,
	typeId: string,
	initial: StatusDef | null,
	onChange: () => Promise<void>,
): void {
	const custom = plugin.settings.customStatuses[typeId] ?? [];
	const existingIds = [
		...STATUSES.map((s) => s.id),
		...custom.map((s) => s.id).filter((id) => id !== initial?.id),
	];
	new StatusModal(app, {
		initial,
		existingIds,
		onSave: async (status) => {
			const list = plugin.settings.customStatuses[typeId] ?? [];
			const index = list.findIndex((s) => s.id === status.id);
			if (index >= 0) list[index] = status;
			else list.push(status);
			plugin.settings.customStatuses[typeId] = list;
			await onChange();
		},
	}).open();
}

async function removeStatus(
	plugin: ContentLogPlugin,
	typeId: string,
	statusId: string,
	onChange: () => Promise<void>,
): Promise<void> {
	const list = plugin.settings.customStatuses[typeId];
	if (!list) return;
	const next = list.filter((s) => s.id !== statusId);
	if (next.length > 0) plugin.settings.customStatuses[typeId] = next;
	else delete plugin.settings.customStatuses[typeId];
	await onChange();
}
