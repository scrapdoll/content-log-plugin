import type { StatusDef } from '../types';

/**
 * Инлайн-стиль пилюли статуса: CSS-переменные фона и текста из палитры
 * Obsidian. null — нейтральное оформление из базового класса .cl-status.
 */
export function statusPillStyle(
	statuses: StatusDef[],
	id: string,
): string | null {
	const color = statuses.find((s) => s.id === id)?.color;
	if (!color) return null;
	return `--cl-status-bg: var(--color-${color}); --cl-status-fg: var(--text-on-accent, #ffffff);`;
}
