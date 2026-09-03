import { type App, type TFile } from 'obsidian';
import type { ContentItem, HltbTimes, TypeSchema } from '../types';
import { parseStatusId } from '../types';
import {
	finiteNumberOrNull,
	nonEmptyStringOrNull,
} from '../utils/guards';
import { frontmatterRepository } from './frontmatter';
import { getTypeSchema, isKnownType } from './registry';

/** Собирает ContentItem из уже прочитанного frontmatter. */
export function contentItemFromFrontmatter(
	file: TFile,
	fm: Record<string, unknown>,
): ContentItem | null {
	const type = fm['type'];
	if (!isKnownType(type)) return null;
	const schema: TypeSchema | undefined = getTypeSchema(type);
	if (!schema) return null;

	const fields: Record<string, string | number> = {};
	for (const field of schema.fields) {
		const value = fm[field.key] ?? legacyMetadataValue(fm, field.key);
		if (typeof value === 'string' || typeof value === 'number') {
			fields[field.key] = value;
		}
	}

	return {
		file,
		type,
		title:
			typeof fm['title'] === 'string' && fm['title']
				? fm['title']
				: file.basename,
		status: parseStatusId(fm['status']),
		fields,
		progress: {
			current: finiteNumberOrNull(
				schema.progressField ? fm[schema.progressField] : undefined,
			),
			total: finiteNumberOrNull(
				schema.progressTotalField
					? fm[schema.progressTotalField]
					: undefined,
			),
		},
		rating: ratingFrom(fm['rating']),
		cover: nonEmptyStringOrNull(fm['cover']),
		source: nonEmptyStringOrNull(fm['source']),
		description: nonEmptyStringOrNull(fm['description']),
		hltb: hltbFromFrontmatter(fm),
		started: nonEmptyStringOrNull(fm['started']),
		finished: nonEmptyStringOrNull(fm['finished']),
	};
}

function legacyMetadataValue(
	fm: Record<string, unknown>,
	key: string,
): unknown {
	if (key === 'metadata-id') return fm['tmdb-id'];
	if (key === 'metadata-rating') return fm['tmdb-rating'];
	return undefined;
}

export function parseContentItem(app: App, file: TFile): ContentItem | null {
	const fm = frontmatterRepository(app).readCached(file);
	return fm ? contentItemFromFrontmatter(file, fm) : null;
}

function hltbFromFrontmatter(fm: Record<string, unknown>): HltbTimes | null {
	const id = finiteNumberOrNull(fm['hltb-id']);
	const main = finiteNumberOrNull(fm['hltb-main']);
	const extra = finiteNumberOrNull(fm['hltb-extra']);
	const complete = finiteNumberOrNull(fm['hltb-complete']);
	if (id === null && main === null && extra === null && complete === null) {
		return null;
	}
	return { id, main, extra, complete };
}

function ratingFrom(value: unknown): number | null {
	const numeric = finiteNumberOrNull(value);
	if (numeric === null) return null;
	const rating = Math.round(numeric);
	return rating >= 1 && rating <= 5 ? rating : null;
}
