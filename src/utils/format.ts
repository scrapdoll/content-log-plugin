/** «46,5 ч» / «46 ч» из часов во frontmatter. */
export function formatHours(hours: number | null): string {
	if (hours === null || hours <= 0) return '—';
	const value = Number.isInteger(hours)
		? String(hours)
		: hours.toFixed(1).replace('.', ',');
	return `${value} ч`;
}
