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

/** Записывает путь обложки в frontmatter карточки. */
export async function writeCover(
	app: App,
	item: ContentItem,
	path: string | null,
): Promise<void> {
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			if (path) {
				fm['cover'] = path;
			} else {
				delete fm['cover'];
			}
		},
	);
	new Notice(path ? 'Обложка обновлена' : 'Обложка убрана');
}

/** Записывает источник контента ( ссылка или текст «где взять» ). */
export async function writeSource(
	app: App,
	item: ContentItem,
	value: string | null,
): Promise<void> {
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			if (value) {
				fm['source'] = value;
			} else {
				delete fm['source'];
			}
		},
	);
	new Notice(value ? 'Источник обновлён' : 'Источник убран');
}

/** Записывает краткое описание карточки. */
export async function writeDescription(
	app: App,
	item: ContentItem,
	value: string | null,
): Promise<void> {
	await frontmatterRepository(app).update(
		item.file,
		(fm: Record<string, unknown>) => {
			if (value) {
				fm['description'] = value;
			} else {
				delete fm['description'];
			}
		},
	);
	new Notice(value ? 'Описание обновлено' : 'Описание убрано');
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
