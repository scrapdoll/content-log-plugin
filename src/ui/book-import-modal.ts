import {
	ButtonComponent,
	Modal,
	Notice,
	Setting,
	type App,
} from 'obsidian';
import type { Frontmatter } from '../core/frontmatter';
import {
	applyBookExtraction,
	bookFieldValueEquals,
} from '../core/book-import/apply';
import type {
	BookExtractionResult,
	ExtractedBookField,
} from '../core/book-import';
import type { ContentItem } from '../types';

/** Предпросмотр различий с безопасным выборочным применением в frontmatter. */
export class BookImportModal extends Modal {
	private selectedKeys = new Set<string>();
	private applyButton: ButtonComponent | undefined;
	private releaseCoverPreview: (() => void) | undefined;
	private busy = false;

	constructor(
		app: App,
		private item: ContentItem,
		private extraction: BookExtractionResult,
		private current: Frontmatter,
		private onApplied: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.releaseCoverPreview?.();
		this.releaseCoverPreview = undefined;
		this.contentEl.empty();
		this.modalEl.addClass('cl-book-import-modal-shell');
		this.contentEl.addClass('content-log-modal', 'cl-book-import-modal');
		this.titleEl.setText('Извлечь данные из источника');
		this.renderTechnicalInfo();
		this.renderFields();
		this.renderActions();
	}

	onClose(): void {
		this.releaseCoverPreview?.();
		this.releaseCoverPreview = undefined;
		this.contentEl.empty();
	}

	private renderTechnicalInfo(): void {
		const technical = this.extraction.technical;
		this.contentEl.createDiv({
			cls: 'cl-modal-section',
			text: 'Источник',
		});
		const info = this.contentEl.createEl('dl', { cls: 'cl-book-import-info' });
		addInfo(info, 'Файл', technical.fileName);
		addInfo(info, 'Формат', technical.format);
		addInfo(info, 'Размер', formatBytes(technical.fileSize));
		addInfo(
			info,
			'SHA-256',
			technical.sha256 ? `${technical.sha256.slice(0, 16)}…` : 'не вычислен',
		);
		addInfo(info, 'Состояние', stateLabel(technical.state));
		if (technical.warnings.length > 0) {
			const warnings = this.contentEl.createEl('ul', {
				cls: 'cl-book-import-warnings',
			});
			for (const warning of technical.warnings) warnings.createEl('li', { text: warning });
		}
	}

	private renderFields(): void {
		this.contentEl.createDiv({
			cls: 'cl-modal-section',
			text: 'Найденные данные',
		});
		const fields = [...this.extraction.fields];
		if (this.extraction.cover) {
			fields.push({
				key: 'cover',
				label: 'Обложка',
				value: `Встроенное изображение (${formatBytes(this.extraction.cover.bytes.length)})`,
				origin: 'embedded',
				confidence: 'high',
			});
		}
		if (fields.length === 0) {
			this.contentEl.createEl('p', {
				cls: 'cl-modal-hint',
				text: 'Данных, которые можно применить, не найдено.',
			});
			return;
		}

		for (const field of fields) this.renderField(field);
	}

	private renderField(field: ExtractedBookField): void {
		const current = this.current[field.key];
		const same =
			field.key === 'cover'
				? false
				: bookFieldValueEquals(current, field.value);
		const empty = current === undefined || current === null || current === '';
		if (!same && empty) this.selectedKeys.add(field.key);
		const currentText = current === undefined ? 'не задано' : formatValue(current);
		const foundText = formatValue(field.value);
		const origin = this.fieldOrigin(field);

		const setting = new Setting(this.contentEl)
			.setName(field.label)
			.setDesc(
				same
					? `Без изменений: ${foundText}`
					: `Сейчас: ${currentText}. Найдено: ${foundText}. Источник: ${origin}.`,
			);
		if (field.key === 'cover') this.renderCoverPreview(setting);
		setting.addToggle((toggle) =>
				toggle
					.setValue(this.selectedKeys.has(field.key))
					.setDisabled(same)
					.onChange((selected) => {
						if (selected) this.selectedKeys.add(field.key);
						else this.selectedKeys.delete(field.key);
						this.updateApplyButton();
					}),
			);
	}

	private renderCoverPreview(setting: Setting): void {
		const cover = this.extraction.cover;
		if (!cover) return;
		const bytes = Uint8Array.from(cover.bytes);
		const url = URL.createObjectURL(
			new Blob([bytes.buffer], { type: cover.mediaType }),
		);
		this.releaseCoverPreview = () => URL.revokeObjectURL(url);
		const image = setting.infoEl.createEl('img', {
			cls: 'cl-book-import-cover-thumb',
			attr: { alt: 'Предпросмотр извлечённой обложки' },
		});
		image.src = url;
		image.decoding = 'async';
		setting.settingEl.addClass('cl-book-import-cover-setting');
		setting.infoEl.addClass('cl-book-import-cover-info');
		setting.infoEl.prepend(image);
	}

	private fieldOrigin(field: ExtractedBookField): string {
		if (field.key === 'cover') {
			return this.extraction.technical.format === 'PDF'
				? 'первая страница файла'
				: 'встроенная обложка';
		}
		return field.origin === 'structure' ? 'структура файла' : 'метаданные файла';
	}

	private renderActions(): void {
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Отмена').onClick(() => this.close()))
			.addButton((button) => {
				this.applyButton = button.setCta().onClick(() => void this.apply());
				this.updateApplyButton();
			});
	}

	private updateApplyButton(): void {
		const count = this.selectedKeys.size;
		this.applyButton
			?.setButtonText(count > 0 ? `Применить (${count})` : 'Нечего применять')
			.setDisabled(count === 0 || this.busy);
	}

	private async apply(): Promise<void> {
		if (this.busy || this.selectedKeys.size === 0) return;
		this.busy = true;
		this.updateApplyButton();
		try {
			await applyBookExtraction(
				this.app,
				this.item,
				this.extraction,
				this.selectedKeys,
			);
			this.close();
			this.onApplied();
		} catch (error) {
			console.error('content-log: book metadata apply failed', error);
			new Notice('Не удалось применить данные книги');
			this.busy = false;
			this.updateApplyButton();
		}
	}
}

function addInfo(parent: HTMLElement, label: string, value: string): void {
	parent.createEl('dt', { text: label });
	parent.createEl('dd', { text: value });
}

function formatValue(value: unknown): string {
	let text: string;
	if (Array.isArray(value)) text = value.join(' · ');
	else if (typeof value === 'string' || typeof value === 'number') text = String(value);
	else text = JSON.stringify(value) ?? String(value);
	return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} Б`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function stateLabel(state: BookExtractionResult['technical']['state']): string {
	return {
		readable: 'прочитан',
		partial: 'прочитан частично',
		encrypted: 'зашифрован или защищён DRM',
		unreadable: 'не удалось прочитать',
	}[state];
}
