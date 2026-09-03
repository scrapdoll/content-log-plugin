import {
	STATUS_COLORS,
	type FieldDef,
	type StatusColor,
	type StatusDef,
	type TypeSchema,
} from '../types';
import { isRecord } from '../utils/guards';

const KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Нормализует список, отбрасывая повреждённые и дублирующиеся схемы. */
export function normalizeTypeSchemas(
	value: unknown,
	reservedIds: Iterable<string> = [],
): TypeSchema[] {
	if (!Array.isArray(value)) return [];
	const ids = new Set(reservedIds);
	const schemas: TypeSchema[] = [];
	for (const candidate of value) {
		const schema = normalizeTypeSchema(candidate);
		if (!schema || ids.has(schema.id)) continue;
		ids.add(schema.id);
		schemas.push(schema);
	}
	return schemas;
}

/**
 * Проверяет и копирует схему из настроек. Повреждённая схема отклоняется
 * целиком, чтобы индексатор никогда не работал с частично валидными полями.
 */
export function normalizeTypeSchema(value: unknown): TypeSchema | null {
	return validateTypeSchema(value).schema;
}

export interface TypeSchemaValidationResult {
	schema: TypeSchema | null;
	errors: string[];
}

/** Та же валидация для UI: возвращает причину вместо молчаливого отказа. */
export function validateTypeSchema(value: unknown): TypeSchemaValidationResult {
	const errors: string[] = [];
	if (!isRecord(value)) {
		return { schema: null, errors: ['Некорректное описание типа'] };
	}
	const id = requiredKey(value['id']);
	const label = requiredText(value['label']);
	if (!id) errors.push('Ключ типа: латиница, цифры, дефис или подчёркивание');
	if (!label) errors.push('Укажите название типа');
	if (!Array.isArray(value['fields'])) errors.push('Некорректный список полей');
	if (errors.length > 0 || !id || !label || !Array.isArray(value['fields'])) {
		return { schema: null, errors };
	}

	const fields: FieldDef[] = [];
	const fieldKeys = new Set<string>();
	for (const candidate of value['fields']) {
		const field = normalizeField(candidate);
		if (!field) {
			errors.push('У каждого поля должны быть корректные ключ, название и тип');
			continue;
		}
		if (fieldKeys.has(field.key)) {
			errors.push(`Дублирующийся ключ поля: ${field.key}`);
			continue;
		}
		fieldKeys.add(field.key);
		fields.push(field);
	}

	const progressField = optionalKey(value['progressField']);
	const progressTotalField = optionalKey(value['progressTotalField']);
	if (progressField === undefined) {
		errors.push('Ключ прогресса: латиница, цифры, дефис или подчёркивание');
	}
	if (progressTotalField === undefined) {
		errors.push('Ключ общего количества: латиница, цифры, дефис или подчёркивание');
	}
	const progressUnit = optionalText(value['progressUnit']) ?? '';
	if (progressField !== null && progressField !== undefined && progressUnit === '') {
		errors.push('Укажите единицу прогресса');
	}

	const quickSteps = value['progressQuickSteps'];
	let progressQuickSteps: number[] = [];
	if (!Array.isArray(quickSteps)) {
		errors.push('Некорректный список быстрых кнопок');
	} else {
		progressQuickSteps = quickSteps.filter(
			(step): step is number =>
				typeof step === 'number' && Number.isFinite(step) && step > 0,
		);
		if (progressQuickSteps.length !== quickSteps.length) {
			errors.push('Быстрые кнопки: положительные числа через запятую');
		} else if (new Set(progressQuickSteps).size !== progressQuickSteps.length) {
			errors.push('Быстрые кнопки не должны повторяться');
		}
	}

	const folder = optionalText(value['folder']) || label;
	if (!isSafeFolder(folder)) {
		errors.push('Папка типа должна находиться внутри корневой папки');
	}
	if (
		errors.length > 0 ||
		progressField === undefined ||
		progressTotalField === undefined
	) {
		return { schema: null, errors };
	}

	const subtitleCandidate = optionalKey(value['subtitleField']);
	if (subtitleCandidate === undefined) {
		return { schema: null, errors: ['Некорректный ключ поля-подзаголовка'] };
	}
	const subtitleField = fields.some(
		(field) => field.key === subtitleCandidate && field.kind === 'text',
	)
		? subtitleCandidate
		: null;

	return {
		schema: {
			id,
			label,
			icon: optionalText(value['icon']) || 'tag',
			folder,
			subtitleField,
			fields,
			progressField,
			progressTotalField: progressField ? progressTotalField : null,
			progressUnit: progressField ? progressUnit : '',
			progressQuickSteps: progressField ? progressQuickSteps : [],
		},
		errors: [],
	};
}

/**
 * Нормализует список пользовательских статусов, отбрасывая повреждённые
 * записи, дубли и коллизии с зарезервированными id.
 */
export function normalizeStatusDefs(
	value: unknown,
	reservedIds: Iterable<string> = [],
): StatusDef[] {
	if (!Array.isArray(value)) return [];
	const ids = new Set(reservedIds);
	const statuses: StatusDef[] = [];
	for (const candidate of value) {
		const status = normalizeStatusDef(candidate);
		if (!status || ids.has(status.id)) continue;
		ids.add(status.id);
		statuses.push(status);
	}
	return statuses;
}

function normalizeStatusDef(value: unknown): StatusDef | null {
	if (!isRecord(value)) return null;
	const id = requiredKey(value['id']);
	const label = requiredText(value['label']);
	const color = value['color'];
	if (!id || !label) return null;
	if (color !== null && !STATUS_COLORS.includes(color as StatusColor)) {
		return null;
	}
	return { id, label, color: color as StatusColor | null };
}

function normalizeField(value: unknown): FieldDef | null {
	if (!isRecord(value)) return null;
	const key = requiredKey(value['key']);
	const label = requiredText(value['label']);
	const kind = value['kind'];
	if (!key || !label || (kind !== 'text' && kind !== 'number')) return null;
	const placeholder = optionalText(value['placeholder']);
	return placeholder ? { key, label, kind, placeholder } : { key, label, kind };
}

function requiredKey(value: unknown): string | null {
	const key = requiredText(value);
	return key && KEY_PATTERN.test(key) ? key : null;
}

function optionalKey(value: unknown): string | null | undefined {
	if (value === null || value === undefined || value === '') return null;
	return requiredKey(value) ?? undefined;
}

function requiredText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text || null;
}

function optionalText(value: unknown): string | null {
	return value === undefined || value === null ? null : requiredText(value);
}

function isSafeFolder(folder: string): boolean {
	if (folder.includes('\\') || folder.startsWith('/') || folder.endsWith('/')) {
		return false;
	}
	if (/[\0:*?"<>|#^[\]]/.test(folder)) return false;
	return folder
		.split('/')
		.every((segment) => Boolean(segment) && segment !== '.' && segment !== '..');
}
