import type { FieldDef, TypeSchema } from '../types';

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
	if (!isRecord(value)) return null;
	const id = requiredKey(value['id']);
	const label = requiredText(value['label']);
	if (!id || !label || !Array.isArray(value['fields'])) return null;

	const fields: FieldDef[] = [];
	const fieldKeys = new Set<string>();
	for (const candidate of value['fields']) {
		const field = normalizeField(candidate);
		if (!field || fieldKeys.has(field.key)) return null;
		fieldKeys.add(field.key);
		fields.push(field);
	}

	const progressField = optionalKey(value['progressField']);
	const progressTotalField = optionalKey(value['progressTotalField']);
	if (progressField === undefined || progressTotalField === undefined) return null;
	const progressUnit = optionalText(value['progressUnit']) ?? '';
	if (progressField !== null && progressUnit === '') return null;

	const quickSteps = value['progressQuickSteps'];
	if (!Array.isArray(quickSteps)) return null;
	const progressQuickSteps = [...new Set(quickSteps)].filter(
		(step): step is number =>
			typeof step === 'number' && Number.isFinite(step) && step > 0,
	);
	if (progressQuickSteps.length !== quickSteps.length) return null;

	const subtitleCandidate = optionalKey(value['subtitleField']);
	if (subtitleCandidate === undefined) return null;
	const subtitleField = fields.some(
		(field) => field.key === subtitleCandidate && field.kind === 'text',
	)
		? subtitleCandidate
		: null;

	return {
		id,
		label,
		icon: optionalText(value['icon']) || 'tag',
		folder: optionalText(value['folder']) || label,
		subtitleField,
		fields,
		progressField,
		progressTotalField: progressField ? progressTotalField : null,
		progressUnit: progressField ? progressUnit : '',
		progressQuickSteps: progressField ? progressQuickSteps : [],
	};
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
