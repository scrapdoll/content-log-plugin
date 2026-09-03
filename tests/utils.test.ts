import { describe, expect, it } from 'vitest';
import { imageExtension, isSafeRasterType } from '../src/core/book-import/image';
import { rebuildTypeRegistry } from '../src/core/registry';
import { formatHours } from '../src/utils/format';
import {
	finiteNumberOrNull,
	isHttpUrl,
	isRecord,
	nonEmptyStringOrNull,
} from '../src/utils/guards';
import {
	normalizeRoot,
	progressPercent,
	progressText,
} from '../src/utils/helpers';
import type { ContentItem } from '../src/types';

describe('shared utilities', () => {
	it('normalizes primitive values at untrusted boundaries', () => {
		expect(isRecord({ value: 1 })).toBe(true);
		expect(isRecord([])).toBe(false);
		expect(finiteNumberOrNull(12.5)).toBe(12.5);
		expect(finiteNumberOrNull(Number.NaN)).toBeNull();
		expect(nonEmptyStringOrNull('text')).toBe('text');
		expect(nonEmptyStringOrNull('')).toBeNull();
		expect(isHttpUrl(' HTTPS://example.com/book ')).toBe(true);
	});

	it('keeps path, progress and hour formatting deterministic', () => {
		rebuildTypeRegistry([], {});
		const item = {
			type: 'book',
			progress: { current: 25, total: 100 },
		} as ContentItem;
		expect(normalizeRoot('\\Content Log\\Books/')).toBe('Content Log/Books');
		expect(progressPercent(item)).toBe(25);
		expect(progressText(item)).toBe('25 / 100 стр. · 25%');
		expect(formatHours(46.5)).toBe('46,5 ч');
		expect(formatHours(null)).toBe('—');
	});

	it('uses one safe raster allowlist for every book adapter', () => {
		expect(isSafeRasterType('image/avif')).toBe(true);
		expect(imageExtension('image/avif')).toBe('avif');
		expect(isSafeRasterType('image/svg+xml')).toBe(false);
		expect(imageExtension('application/octet-stream')).toBe('bin');
	});
});
