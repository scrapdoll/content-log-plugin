import {
	BUILTIN_TYPES,
	type ContentTypeId,
	type StatusDef,
	STATUSES,
	type TypeSchema,
} from '../types';
import {
	normalizeStatusDefs,
	normalizeTypeSchema,
	normalizeTypeSchemas,
} from './type-schema';
import { isRecord } from '../utils/guards';

/** Схема типа с окончательным списком статусов: встроенные плюс пользовательские. */
export type ResolvedTypeSchema = TypeSchema & { statuses: StatusDef[] };

/**
 * Реестр типов контента: встроенные типы плюс пользовательские из настроек.
 * Пересобирается при загрузке плагина и при изменении настроек.
 */
const registry = new Map<string, ResolvedTypeSchema>();

export function rebuildTypeRegistry(
	custom: unknown,
	customStatuses: unknown,
): void {
	registry.clear();
	for (const candidate of BUILTIN_TYPES) {
		const schema = normalizeTypeSchema(candidate);
		if (schema) registry.set(schema.id, withStatuses(schema, customStatuses));
	}
	for (const schema of normalizeTypeSchemas(custom, registry.keys())) {
		registry.set(schema.id, withStatuses(schema, customStatuses));
	}
}

function withStatuses(
	schema: TypeSchema,
	customStatuses: unknown,
): ResolvedTypeSchema {
	const extra = isRecord(customStatuses) ? customStatuses[schema.id] : undefined;
	return {
		...schema,
		statuses: [
			...STATUSES,
			...normalizeStatusDefs(extra, STATUSES.map((s) => s.id)),
		],
	};
}

export function getTypeSchema(id: string): ResolvedTypeSchema | undefined {
	return registry.get(id);
}

export function getAllTypeSchemas(): ResolvedTypeSchema[] {
	return [...registry.values()];
}

/** Статусы конкретного типа; для неизвестного типа — только встроенные. */
export function statusesForType(id: string): StatusDef[] {
	return getTypeSchema(id)?.statuses ?? STATUSES;
}

/** Объединение статусов всех типов с дедупом по id — для фильтра и сводки. */
export function getAllStatuses(): StatusDef[] {
	const byId = new Map<string, StatusDef>();
	for (const schema of registry.values()) {
		for (const status of schema.statuses) {
			if (!byId.has(status.id)) byId.set(status.id, status);
		}
	}
	return [...byId.values()];
}

export function isKnownType(value: unknown): value is ContentTypeId {
	return typeof value === 'string' && registry.has(value);
}
