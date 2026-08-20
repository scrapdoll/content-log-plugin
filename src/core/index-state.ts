/** Путь расположен внутри настроенного корня либо совпадает с ним. */
export function isInsideRoot(root: string, path: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

/** В индекс попадают Markdown-карточки, но не вложенные заметки карточек. */
export function isContentCardPath(root: string, path: string): boolean {
	if (!isInsideRoot(root, path) || !path.toLowerCase().endsWith('.md')) {
		return false;
	}
	const relative = path.slice(root.length + 1);
	return !relative.split('/').includes('Notes');
}

/** Удаляет файл или всё содержимое удалённой/переименованной папки. */
export function removeIndexedPath<T>(items: Map<string, T>, path: string): boolean {
	let changed = false;
	for (const key of [...items.keys()]) {
		if (key === path || key.startsWith(`${path}/`)) {
			items.delete(key);
			changed = true;
		}
	}
	return changed;
}
