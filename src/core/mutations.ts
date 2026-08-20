import { App, Notice } from 'obsidian';
import { getTypeSchema } from './registry';
import { type HltbGame } from './hltb';
import {
	type ContentItem,
	type ContentStatus,
	statusLabel,
} from '../types';
import { todayISO } from '../utils/helpers';
import {
	applyProgressChange,
	applyStatusChange,
} from './frontmatter-transitions';
import { frontmatterRepository } from './frontmatter';

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
	status: ContentStatus,
): Promise<void> {
	const today = todayISO();
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			applyStatusChange(fm, status, today);
		},
	);
	new Notice(`Статус: ${statusLabel(status)}`);
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
