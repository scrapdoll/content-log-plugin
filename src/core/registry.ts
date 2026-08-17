import {
	BUILTIN_TYPES,
	type ContentTypeId,
	type TypeSchema,
} from '../types';

/**
 * Реестр типов контента: встроенные типы плюс пользовательские из настроек.
 * Пересобирается при загрузке плагина и при изменении настроек.
 */
const registry = new Map<string, TypeSchema>();

export function rebuildTypeRegistry(custom: unknown): void {
	registry.clear();
	for (const schema of BUILTIN_TYPES) {
		registry.set(schema.id, schema);
	}
	if (!Array.isArray(custom)) return;
	for (const entry of custom) {
		const schema = entry as TypeSchema | null;
		if (
			!schema ||
			typeof schema.id !== 'string' ||
			schema.id === '' ||
			registry.has(schema.id)
		) {
			continue;
		}
		registry.set(schema.id, {
			...schema,
			label: schema.label || schema.id,
			icon: schema.icon || 'tag',
			folder: schema.folder || schema.label || schema.id,
			subtitleField: schema.subtitleField ?? null,
			fields: Array.isArray(schema.fields) ? schema.fields : [],
			progressField: schema.progressField ?? null,
			progressTotalField: schema.progressTotalField ?? null,
			progressUnit: schema.progressUnit ?? '',
			progressQuickSteps: Array.isArray(schema.progressQuickSteps)
				? schema.progressQuickSteps.filter(
						(step) => typeof step === 'number' && step > 0,
					)
				: [],
		});
	}
}

export function getTypeSchema(id: string): TypeSchema | undefined {
	return registry.get(id);
}

export function getAllTypeSchemas(): TypeSchema[] {
	return [...registry.values()];
}

export function isKnownType(value: unknown): value is ContentTypeId {
	return typeof value === 'string' && registry.has(value);
}
