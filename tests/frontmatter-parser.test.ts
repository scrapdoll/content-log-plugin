import { describe, expect, it } from 'vitest';
import { parseFrontmatterText } from '../src/core/frontmatter';

describe('parseFrontmatterText', () => {
	it('preserves quoted numeric strings', () => {
		const parsed = parseFrontmatterText('---\ntitle: "1984"\nyear: 1949\n---\n# 1984');

		expect(parsed).toEqual({ title: '1984', year: 1949 });
	});

	it('parses block scalars and YAML collections using the Obsidian parser', () => {
		const parsed = parseFrontmatterText(
			'---\ndescription: >\n  Первая строка\n  и вторая\ntags:\n  - fiction\n  - classic\n---\n',
		);

		expect(parsed).toEqual({
			description: 'Первая строка и вторая\n',
			tags: ['fiction', 'classic'],
		});
	});

	it('returns null for missing or invalid frontmatter', () => {
		expect(parseFrontmatterText('# Без frontmatter')).toBeNull();
		expect(parseFrontmatterText('---\ninvalid: [\n---\n')).toBeNull();
	});
});
