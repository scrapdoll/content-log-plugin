import {
	type ContentStatus,
	toStatus,
} from '../types';
import { finiteNumberOrNull } from '../utils/guards';

type Frontmatter = Record<string, unknown>;

interface ProgressFields {
	progressField: string;
	progressTotalField: string | null;
}

/**
 * Применяет изменение прогресса к актуальному frontmatter.
 * Возвращает нормализованное значение, которое было записано.
 */
export function applyProgressChange(
	fm: Frontmatter,
	schema: ProgressFields,
	value: number,
	today: string,
): number {
	const total = schema.progressTotalField
		? finiteNumberOrNull(fm[schema.progressTotalField])
		: null;
	let next = Math.max(0, Math.round(value * 100) / 100);
	if (total !== null) next = Math.min(next, total);
	fm[schema.progressField] = next;

	const currentStatus = toStatus(fm['status']);
	if (total !== null && next >= total) {
		applyStatusChange(fm, 'finished', today);
	} else if (currentStatus === 'planned' && next > 0) {
		applyStatusChange(fm, 'in-progress', today);
	} else if (currentStatus === 'finished' && total !== null && next < total) {
		applyStatusChange(fm, next === 0 ? 'planned' : 'in-progress', today);
	}

	return next;
}

/** Поддерживает status, started и finished как единое состояние. */
export function applyStatusChange(
	fm: Frontmatter,
	status: ContentStatus,
	today: string,
): void {
	fm['status'] = status;
	switch (status) {
		case 'planned':
			delete fm['started'];
			delete fm['finished'];
			break;
		case 'in-progress':
			if (!fm['started']) fm['started'] = today;
			delete fm['finished'];
			break;
		case 'finished':
			if (!fm['started']) fm['started'] = today;
			fm['finished'] = today;
			break;
		case 'abandoned':
			delete fm['finished'];
			break;
	}
}
