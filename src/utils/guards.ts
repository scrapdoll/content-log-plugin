/** Общие runtime-guards для данных из frontmatter, API и настроек. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function finiteNumberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function nonEmptyStringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

export function isHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
