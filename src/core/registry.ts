import {
	BUILTIN_TYPES,
	type ContentTypeId,
	type TypeSchema,
} from '../types';
import { normalizeTypeSchema, normalizeTypeSchemas } from './type-schema';

/**
 * Реестр типов контента: встроенные типы плюс пользовательские из настроек.
 * Пересобирается при загрузке плагина и при изменении настроек.
 */
const registry = new Map<string, TypeSchema>();

export function rebuildTypeRegistry(custom: unknown): void {
	registry.clear();
	for (const candidate of BUILTIN_TYPES) {
		const schema = normalizeTypeSchema(candidate);
		if (schema) registry.set(schema.id, schema);
	}
	for (const schema of normalizeTypeSchemas(custom, registry.keys())) {
		registry.set(schema.id, schema);
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
