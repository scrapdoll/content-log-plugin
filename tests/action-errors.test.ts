import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failLog, runCardAction } from '../src/ui/action-errors';
import { Notice } from './obsidian';

describe('card action errors', () => {
	beforeEach(() => {
		Notice.messages = [];
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reports failures to both the log and the user', () => {
		const error = new Error('write failed');
		failLog('cover update', 'Не удалось обновить обложку')(error);

		expect(console.error).toHaveBeenCalledWith(
			'content-log: cover update failed',
			error,
		);
		expect(Notice.messages).toEqual(['Не удалось обновить обложку']);
	});

	it('refreshes only after a successful action', async () => {
		const refresh = vi.fn();
		runCardAction('update', refresh, Promise.resolve());
		await Promise.resolve();

		expect(refresh).toHaveBeenCalledOnce();
	});
});
