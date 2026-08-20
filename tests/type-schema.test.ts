import { describe, expect, it } from 'vitest';
import {
	normalizeTypeSchema,
	normalizeTypeSchemas,
} from '../src/core/type-schema';

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
