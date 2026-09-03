import { describe, expect, it } from 'vitest';
import {
	normalizeStatusDefs,
	normalizeTypeSchema,
	normalizeTypeSchemas,
	validateTypeSchema,
} from '../src/core/type-schema';
import { BUILTIN_TYPES } from '../src/types';

const VALID_SCHEMA = {
	id: 'podcast',
	label: 'Подкаст',
	icon: 'headphones',
	folder: 'Podcasts',
	subtitleField: 'host',
	fields: [{ key: 'host', label: 'Ведущий', kind: 'text' }],
	progressField: 'episodes-listened',
	progressTotalField: 'episodes-total',
	progressUnit: 'эп.',
	progressQuickSteps: [1, 5],
};

describe('normalizeTypeSchema', () => {
	it('provides built-in series and anime schemas with episode progress', () => {
		for (const id of ['series', 'anime']) {
			const schema = BUILTIN_TYPES.find((candidate) => candidate.id === id);
			expect(schema).toMatchObject({
				id,
				progressField: 'episodes-watched',
				progressTotalField: 'episodes-total',
				progressQuickSteps: [1, 5],
			});
		}
	});

	it('returns a detached normalized schema', () => {
		const schema = normalizeTypeSchema(VALID_SCHEMA);

		expect(schema).toEqual(VALID_SCHEMA);
		expect(schema).not.toBe(VALID_SCHEMA);
		expect(schema?.fields).not.toBe(VALID_SCHEMA.fields);
	});

	it.each([
		{ ...VALID_SCHEMA, id: '../podcast' },
		{ ...VALID_SCHEMA, fields: [null] },
		{
			...VALID_SCHEMA,
			fields: [
				{ key: 'host', label: 'Ведущий', kind: 'text' },
				{ key: 'host', label: 'Автор', kind: 'text' },
			],
		},
		{ ...VALID_SCHEMA, progressQuickSteps: [1, -5] },
		{ ...VALID_SCHEMA, progressUnit: '' },
	])('rejects a damaged persisted schema', (value) => {
		expect(normalizeTypeSchema(value)).toBeNull();
	});

	it('clears references to missing subtitle fields', () => {
		const schema = normalizeTypeSchema({
			...VALID_SCHEMA,
			subtitleField: 'missing',
		});

		expect(schema?.subtitleField).toBeNull();
	});

	it.each([
		[{ ...VALID_SCHEMA, progressQuickSteps: [5, 5] }, 'не должны повторяться'],
		[{ ...VALID_SCHEMA, progressField: 'прочитано страниц' }, 'Ключ прогресса'],
		[{ ...VALID_SCHEMA, folder: '../..' }, 'Папка типа'],
	])('returns an actionable validation error for the editor', (value, message) => {
		const result = validateTypeSchema(value);

		expect(result.schema).toBeNull();
		expect(result.errors.join(' ')).toContain(message);
	});

	it('normalizes persisted lists and removes reserved or duplicate ids', () => {
		const schemas = normalizeTypeSchemas(
			[
				VALID_SCHEMA,
				{ ...VALID_SCHEMA },
				{ ...VALID_SCHEMA, id: 'book' },
				{ ...VALID_SCHEMA, id: '../invalid' },
			],
			['book'],
		);

		expect(schemas.map((schema) => schema.id)).toEqual(['podcast']);
	});
});

describe('normalizeStatusDefs', () => {
	it('drops damaged entries, duplicates and reserved ids', () => {
		const statuses = normalizeStatusDefs(
			[
				{ id: 'on-hold', label: 'На паузе', color: 'purple' },
				{ id: 'on-hold', label: 'Дубль', color: null },
				{ id: 'finished', label: 'Как встроенный', color: null },
				{ id: 'плохой ключ', label: 'Ключ', color: null },
				{ id: 'no-label', label: '', color: null },
				{ id: 'bad-color', label: 'Цвет', color: 'chartreuse' },
				{ id: 'neutral', label: 'Без цвета', color: null },
				42,
			],
			['finished'],
		);

		expect(statuses).toEqual([
			{ id: 'on-hold', label: 'На паузе', color: 'purple' },
			{ id: 'neutral', label: 'Без цвета', color: null },
		]);
	});

	it('returns an empty list for non-array input', () => {
		expect(normalizeStatusDefs('garbage')).toEqual([]);
		expect(normalizeStatusDefs(null)).toEqual([]);
	});
});
