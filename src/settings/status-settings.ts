import { type App } from 'obsidian';
import type ContentLogPlugin from '../main';
import {
	getAllTypeSchemas,
	type ResolvedTypeSchema,
} from '../core/registry';
import { STATUSES, type StatusDef } from '../types';
import { StatusModal } from '../ui/status-modal';
import { statusPillStyle } from '../ui/status-style';

/** Отдельное представление настроек статусов по типам контента. */
export function renderStatusSettings(
	app: App,
	plugin: ContentLogPlugin,
	container: HTMLElement,
	onChange: () => Promise<void>,
): void {
	container.createEl('p', {
		cls: 'setting-item-description',
		text: 'Встроенные статусы есть у каждого типа и их список не меняется. Дополнительный статус — только метка: он не трогает даты и не участвует в автопереходах прогресса.',
	});

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

	const block = container.createEl('details', { cls: 'cl-status-type' });
	const summary = block.createEl('summary');
	summary.appendText(schema.label);
	if (custom.length > 0) {
		summary.createSpan({
			cls: 'cl-status-type-badge',
			text: String(custom.length),
			attr: { 'aria-label': 'Количество дополнительных статусов' },
		});
	}

	const content = block.createDiv({ cls: 'cl-status-type-content' });

	content.createDiv({ cls: 'cl-status-group-hint', text: 'Встроенные' });
	renderStatusPills(content, STATUSES);

	content.createDiv({ cls: 'cl-status-group-hint', text: 'Дополнительные' });
	if (custom.length === 0) {
		content.createEl('p', {
			cls: 'cl-status-empty-hint',
			text: 'Дополнительных статусов нет.',
		});
	} else {
		for (const status of custom) {
			renderStatusRow(app, plugin, content, schema, status, onChange);
		}
	}

	const add = content.createEl('button', {
		cls: 'cl-status-add',
		text: '+ Добавить статус',
	});
	add.addEventListener('click', () => {
		openStatusModal(app, plugin, schema.id, null, onChange);
	});
}

function renderStatusPills(
	container: HTMLElement,
	statuses: StatusDef[],
): void {
	const pills = container.createDiv({ cls: 'cl-status-pills' });
	for (const status of statuses) {
		const style = statusPillStyle(statuses, status.id);
		pills.createSpan({
			cls: 'cl-status',
			text: status.label,
			attr: style ? { style } : {},
		});
	}
}

function renderStatusRow(
	app: App,
	plugin: ContentLogPlugin,
	container: HTMLElement,
	schema: ResolvedTypeSchema,
	status: StatusDef,
	onChange: () => Promise<void>,
): void {
	const row = container.createDiv({ cls: 'cl-status-row' });

	const style = statusPillStyle(schema.statuses, status.id);
	row.createSpan({
		cls: 'cl-status',
		text: status.label,
		attr: style ? { style } : {},
	});
	row.createSpan({ cls: 'cl-status-row-key', text: status.id });

	const actions = row.createSpan({ cls: 'cl-status-row-actions' });
	const edit = actions.createEl('button', {
		cls: 'cl-status-action',
		text: 'Изменить',
		attr: { 'aria-label': `Изменить статус «${status.label}»` },
	});
	edit.addEventListener('click', () => {
		openStatusModal(app, plugin, schema.id, status, onChange);
	});
	actions.createSpan({ cls: 'cl-status-action-sep', text: '|' });
	const remove = actions.createEl('button', {
		cls: 'cl-status-action is-danger',
		text: 'Удалить',
		attr: { 'aria-label': `Удалить статус «${status.label}»` },
	});
	remove.addEventListener('click', () => {
		void removeStatus(plugin, schema.id, status.id, onChange);
	});
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
