import { parse } from 'yaml';

export class App {}

export class FileSystemAdapter {}

export class TFile {
	path: string;
	extension: string;
	name: string;
	basename: string;
	parent: { path: string } | null;
	stat = { mtime: 0 };

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').at(-1) ?? path;
		this.extension = this.name.includes('.')
			? (this.name.split('.').at(-1) ?? '')
			: '';
		const slash = path.lastIndexOf('/');
		this.parent = slash >= 0 ? { path: path.slice(0, slash) } : null;
		this.basename = this.extension
			? this.name.slice(0, -(this.extension.length + 1))
			: this.name;
	}
}

export class TFolder {
	path: string;
	name: string;
	children: Array<TFile | TFolder> = [];

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').at(-1) ?? path;
	}
}

export class Events {
	private listeners = new Map<string, Set<(...data: unknown[]) => void>>();

	on(name: string, callback: (...data: unknown[]) => void): object {
		const listeners = this.listeners.get(name) ?? new Set();
		listeners.add(callback);
		this.listeners.set(name, listeners);
		return {};
	}

	off(name: string, callback: (...data: unknown[]) => void): void {
		this.listeners.get(name)?.delete(callback);
	}

	trigger(name: string, ...data: unknown[]): void {
		for (const callback of this.listeners.get(name) ?? []) callback(...data);
	}
}

export function debounce(callback: () => void): () => void {
	return callback;
}

export class Notice {
	static messages: string[] = [];

	constructor(message: string) {
		Notice.messages.push(message);
	}
}

export const Platform = {
	isDesktopApp: false,
};

export function getFrontMatterInfo(content: string): {
	exists: boolean;
	frontmatter: string;
} {
	const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
	return {
		exists: match !== null,
		frontmatter: match?.[1] ?? '',
	};
}

export function parseYaml(yaml: string): unknown {
	return parse(yaml);
}
