export function failLog(scope: string): (error: unknown) => void {
	return (error) => console.error(`content-log: ${scope} failed`, error);
}
