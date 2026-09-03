import { App, Notice } from 'obsidian';
import { getTypeSchema, statusesForType } from './registry';
import { type HltbGame } from './hltb';
import type { MediaMetadataDetails } from './metadata-provider';
import {
	type ContentItem,
	type ContentStatusId,
	labelForStatus,
	parseStatusId,
} from '../types';
import { todayISO } from '../utils/helpers';
import {
	applyProgressChange,
	applyStatusChange,
} from './frontmatter-transitions';
import { frontmatterRepository } from './frontmatter';

export interface ContentCardEditInput {
	title: string;
	status: ContentStatusId;
	fields: Record<string, string | number>;
	cover: string | null;
	source: string | null;
	description: string | null;
}

/** Обновляет редактируемые поля карточки, сохраняя неизвестный frontmatter. */
export async function writeContentCard(
	app: App,
	item: ContentItem,
	input: ContentCardEditInput,
): Promise<void> {
	const schema = getTypeSchema(item.type);
	if (!schema) throw new Error(`Unknown content type: ${item.type}`);
	const title = input.title.trim();
	if (!title) throw new Error('Content title is required');

	await frontmatterRepository(app).update(item.file, (fm) => {
		fm['title'] = title;
		if (parseStatusId(fm['status']) !== input.status) {
			applyStatusChange(fm, input.status, todayISO());
		}
		for (const field of schema.fields) {
			const value = input.fields[field.key];
			if (value === undefined || value === '') delete fm[field.key];
			else fm[field.key] = value;
		}
		writeOptionalText(fm, 'cover', input.cover);
		writeOptionalText(fm, 'source', input.source);
		writeOptionalText(fm, 'description', input.description);
	});
	new Notice('Карточка обновлена');
}

function writeOptionalText(
	fm: Record<string, unknown>,
	key: string,
	value: string | null,
): void {
	const normalized = value?.trim() ?? '';
	if (normalized) fm[key] = normalized;
	else delete fm[key];
}

/**
 * Записывает прогресс в frontmatter карточки. При выходе на полную
 * величину автоматически переводит статус в «Завершено».
 */
export async function writeProgress(
	app: App,
	item: ContentItem,
	value: number,
): Promise<void> {
	const schema = getTypeSchema(item.type);
	const field = schema?.progressField;
	if (!schema || !field) return;

	let next = 0;
	const today = todayISO();

	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			next = applyProgressChange(
				fm,
				{
					progressField: field,
					progressTotalField: schema.progressTotalField,
				},
				value,
				today,
			);
		},
	);
	new Notice(`Прогресс: ${next} ${schema.progressUnit}`);
}

/**
 * Меняет общую величину прогресса ( у книг — всего страниц ). Пустое
 * значение убирает поле. Прочитанное при необходимости ужимается до
 * новой величины, чтобы прогресс не превышал 100%.
 */
export async function writeProgressTotal(
	app: App,
	item: ContentItem,
	value: number | null,
): Promise<void> {
	const schema = getTypeSchema(item.type);
	const field = schema?.progressTotalField;
	const progressField = schema?.progressField;
	if (!schema || !field || !progressField) return;

	const total =
		value !== null ? Math.max(0, Math.round(value * 100) / 100) : null;
	const today = todayISO();
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			if (total !== null && total > 0) {
				fm[field] = total;
			} else {
				delete fm[field];
			}
			const readValue = fm[progressField];
			const read =
				typeof readValue === 'number' && Number.isFinite(readValue)
					? readValue
					: null;
			if (total !== null && read !== null && read > total) {
				applyProgressChange(
					fm,
					{ progressField, progressTotalField: field },
					total,
					today,
				);
			}
		},
	);
	new Notice(
		total !== null && total > 0
			? `Всего: ${total} ${schema.progressUnit}`
			: 'Общее количество убрано',
	);
}

/** Меняет статус и поддерживает даты started/finished в согласованном виде. */
export async function writeStatus(
	app: App,
	item: ContentItem,
	status: ContentStatusId,
): Promise<void> {
	const today = todayISO();
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			applyStatusChange(fm, status, today);
		},
	);
	new Notice(
		`Статус: ${labelForStatus(statusesForType(item.type), status)}`,
	);
}

/** Ставит оценку 1–5; значения вне диапазона снимают оценку. */
export async function writeRating(
	app: App,
	item: ContentItem,
	rating: number,
): Promise<void> {
	const valid = rating >= 1 && rating <= 5;
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			if (valid) {
				fm['rating'] = rating;
			} else {
				delete fm['rating'];
			}
		},
	);
	new Notice(valid ? `Оценка: ${'★'.repeat(rating)}` : 'Оценка снята');
}

type TextFieldKey = 'cover' | 'source' | 'description';

const TEXT_FIELD_NOTICES: Record<TextFieldKey, readonly [string, string]> = {
	cover: ['Обложка обновлена', 'Обложка убрана'],
	source: ['Источник обновлён', 'Источник убран'],
	description: ['Описание обновлено', 'Описание убрано'],
};

export async function writeCover(
	app: App,
	item: ContentItem,
	path: string | null,
): Promise<void> {
	await writeTextField(app, item, 'cover', path);
}

export async function writeSource(
	app: App,
	item: ContentItem,
	value: string | null,
): Promise<void> {
	await writeTextField(app, item, 'source', value);
}

export async function writeDescription(
	app: App,
	item: ContentItem,
	value: string | null,
): Promise<void> {
	await writeTextField(app, item, 'description', value);
}

/** Записывает текстовое поле либо удаляет ключ, сохраняя единый UX. */
async function writeTextField(
	app: App,
	item: ContentItem,
	key: TextFieldKey,
	value: string | null,
): Promise<void> {
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			if (value) {
				fm[key] = value;
			} else {
				delete fm[key];
			}
		},
	);
	const notices = TEXT_FIELD_NOTICES[key];
	new Notice(value ? notices[0] : notices[1]);
}

/**
 * Записывает данные HowLongToBeat: id игры и времена прохождения.
 * Обложку ставит ссылкой на CDN сайта ( только если обложки ещё нет );
 * краткую заметку пользователя не трогает.
 */
export async function writeHltb(
	app: App,
	item: ContentItem,
	game: HltbGame,
): Promise<void> {
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			fm['hltb-id'] = game.id;
			writeHours(fm, 'hltb-main', game.mainHours);
			writeHours(fm, 'hltb-extra', game.extraHours);
			writeHours(fm, 'hltb-complete', game.completeHours);
			if (!fm['cover']) fm['cover'] = game.imageUrl;
		},
	);
	new Notice('Данные howlongtobeat.com записаны');
}

/** Записывает нормализованные данные выбранного каталога без provider-specific ветвлений. */
export async function writeMediaMetadata(
	app: App,
	item: ContentItem,
	details: MediaMetadataDetails,
): Promise<void> {
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			fm['metadata-provider'] = details.providerId;
			fm['metadata-id'] = details.itemId;
			fm['metadata-url'] = details.providerUrl;
			writeMetadata(fm, 'original-title', details.originalTitle);
			writeMetadata(fm, 'year', details.year);
			writeMetadata(fm, 'genres', details.genres);
			writeMetadata(fm, 'metadata-rating', details.rating);
			delete fm['tmdb-id'];
			delete fm['tmdb-type'];
			delete fm['tmdb-url'];
			delete fm['tmdb-rating'];

			if (item.type === 'movie' || item.type === 'anime') {
				writeMetadata(fm, 'director', details.director);
				writeMetadata(fm, 'runtime', details.runtimeMinutes);
			}
			if (item.type === 'series' || item.type === 'anime') {
				writeMetadata(fm, 'creator', details.creator);
				writeMetadata(fm, 'seasons-total', details.seasonsTotal);
				writeMetadata(fm, 'episodes-total', details.episodesTotal);
				const watched = fm['episodes-watched'];
				if (
					details.episodesTotal !== null &&
					typeof watched === 'number' &&
					Number.isFinite(watched) &&
					watched > details.episodesTotal
				) {
					applyProgressChange(
						fm,
						{
							progressField: 'episodes-watched',
							progressTotalField: 'episodes-total',
						},
						details.episodesTotal,
						todayISO(),
					);
				}
			}
			if (item.type === 'anime') {
				writeMetadata(fm, 'studio', details.studio);
			}

			if (!fm['cover'] && details.posterUrl) fm['cover'] = details.posterUrl;
			if (!fm['description'] && details.overview) {
				fm['description'] = details.overview;
			}
		},
	);
	new Notice('Метаданные записаны');
}

function writeMetadata(
	fm: Record<string, unknown>,
	key: string,
	value: string | number | null,
): void {
	if (value === null || value === '') {
		delete fm[key];
	} else {
		fm[key] = value;
	}
}

function writeHours(
	fm: Record<string, unknown>,
	key: string,
	hours: number | null,
): void {
	if (hours === null) {
		delete fm[key];
	} else {
		fm[key] = hours;
	}
}
