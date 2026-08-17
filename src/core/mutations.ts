import { App, Notice } from 'obsidian';
import { getTypeSchema } from './registry';
import {
	type ContentItem,
	type ContentStatus,
	statusLabel,
} from '../types';
import { todayISO } from '../utils/helpers';

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

	let next = Math.max(0, Math.round(value * 100) / 100);
	if (item.progress.total !== null) {
		next = Math.min(next, item.progress.total);
	}

	await app.fileManager.processFrontMatter(
		item.file,
		(fm: Record<string, unknown>) => {
			fm[field] = next;
		if (item.status === 'planned' && next > 0) {
			fm['status'] = 'in-progress';
			if (!fm['started']) fm['started'] = todayISO();
		}
			if (item.progress.total !== null && next >= item.progress.total) {
				fm['status'] = 'finished';
				fm['finished'] = todayISO();
				if (!fm['started']) fm['started'] = todayISO();
			}
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
	await app.fileManager.processFrontMatter(
		item.file,
		(fm: Record<string, unknown>) => {
			fm['status'] = status;
			switch (status) {
				case 'planned':
					delete fm['started'];
					delete fm['finished'];
					break;
				case 'in-progress':
					if (!fm['started']) fm['started'] = todayISO();
					delete fm['finished'];
					break;
				case 'finished':
					if (!fm['started']) fm['started'] = todayISO();
					fm['finished'] = todayISO();
					break;
				case 'abandoned':
					break;
			}
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
	await app.fileManager.processFrontMatter(
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
	await app.fileManager.processFrontMatter(
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
