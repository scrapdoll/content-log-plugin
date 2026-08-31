const BUILTIN_CARD_TEMPLATES: Record<string, string> = {
	book: '# {{title}}\n\n## Впечатления\n\n## Цитаты\n',
	movie: '# {{title}}\n\n## Впечатления\n\n## Заметки\n',
	series: '# {{title}}\n\n## Впечатления\n\n## Заметки\n',
	anime: '# {{title}}\n\n## Впечатления\n\n## Заметки\n',
	game: '# {{title}}\n\n## Впечатления\n\n## Заметки\n',
};

const DEFAULT_CARD_TEMPLATE = '# {{title}}\n\n## Впечатления\n\n## Заметки\n';

export function renderCardTemplate(
	type: string,
	vars: Record<string, string>,
): string {
	let text = BUILTIN_CARD_TEMPLATES[type] ?? DEFAULT_CARD_TEMPLATE;
	for (const [key, value] of Object.entries(vars)) {
		text = text.replaceAll(`{{${key}}}`, value);
	}
	return text;
}

/** Тело заметки внутри папки Notes: обратная ссылка на карточку контента. */
export function renderNoteTemplate(cardName: string): string {
	return `← [[${cardName}]]\n\n`;
}
