import { Notice } from 'obsidian';

export function reportActionError(
	scope: string,
	error: unknown,
	message = 'Не удалось выполнить действие',
): void {
	console.error(`content-log: ${scope} failed`, error);
	new Notice(message);
}

export function failLog(
	scope: string,
	message?: string,
): (error: unknown) => void {
	return (error) => reportActionError(scope, error, message);
}

/** Единый запуск мутации карточки: refresh только после успешной записи. */
export function runCardAction(
	scope: string,
	refresh: (() => void) | undefined,
	action: Promise<unknown>,
	message?: string,
): void {
	void action.then(() => refresh?.()).catch(failLog(scope, message));
}

export type CardActionRunner = (
	scope: string,
	action: Promise<unknown>,
	message?: string,
) => void;

export function createCardActionRunner(
	refresh?: () => void,
): CardActionRunner {
	return (scope, action, message) =>
		runCardAction(scope, refresh, action, message);
}
