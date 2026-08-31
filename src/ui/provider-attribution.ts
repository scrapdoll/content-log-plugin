import type { MetadataProviderAttribution } from '../core/metadata-provider';

export function renderProviderAttribution(
	container: HTMLElement,
	attribution: MetadataProviderAttribution | null,
): void {
	if (!attribution) return;
	const element = container.createDiv({ cls: 'cl-metadata-attribution' });
	const link = element.createEl('a', {
		attr: {
			href: attribution.url,
			target: '_blank',
			rel: 'noopener noreferrer',
		},
	});
	link.createEl('img', {
		attr: {
			src: attribution.logoDataUrl,
			alt: attribution.logoAlt,
		},
	});
	element.createDiv({ text: attribution.notice });
}
