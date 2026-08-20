import { zipSync, strToU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applySelectedBookFields } from '../src/core/book-import/apply';
import { extractBookSource } from '../src/core/book-import';
import { mobiMetadataToRaw } from '../src/core/book-import/mobi';
import { pdfCoverDimensions } from '../src/core/book-import/pdf';

function fieldMap(result: Awaited<ReturnType<typeof extractBookSource>>) {
	return Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
}

beforeAll(() => {
	vi.stubGlobal('window', { crypto });
});

describe('book source extraction', () => {
	it('extracts EPUB metadata, toc, page-independent chapters and cover', async () => {
		const epub = zipSync({
			mimetype: strToU8('application/epub+zip'),
			'META-INF/container.xml': strToU8(`<?xml version="1.0"?>
				<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
					<rootfiles><rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
				</container>`),
			'OPS/content.opf': strToU8(`<?xml version="1.0"?>
				<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
					<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
						<dc:title>Дюна</dc:title><dc:creator>Фрэнк Герберт</dc:creator>
						<dc:language>ru</dc:language><dc:publisher>Издательство</dc:publisher>
						<dc:date>1965</dc:date><dc:identifier>ISBN 978-5-00000-000-1</dc:identifier>
						<dc:description>Описание книги</dc:description><dc:subject>Фантастика</dc:subject>
						<meta name="calibre:series" content="Хроники Дюны"/>
						<meta name="calibre:series_index" content="1"/>
					</metadata>
					<manifest>
						<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
						<item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
					</manifest><spine/>
				</package>`),
			'OPS/nav.xhtml': strToU8(`<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
				<nav epub:type="toc"><ol><li><a href="one.xhtml">Глава 1</a></li><li><a href="two.xhtml">Глава 2</a></li></ol></nav>
			</body></html>`),
			'OPS/cover.jpg': new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
		});

		const result = await extractBookSource(epub, 'epub', 'dune.epub');
		const fields = fieldMap(result);
		expect(result.technical.state).toBe('readable');
		expect(fields).toMatchObject({
			title: 'Дюна',
			author: 'Фрэнк Герберт',
			language: 'ru',
			publisher: 'Издательство',
			published: '1965',
			isbn: '9785000000001',
			series: 'Хроники Дюны',
			'series-index': '1',
			'chapters-total': 2,
			'table-of-contents': ['Глава 1', 'Глава 2'],
		});
		expect(result.cover?.mediaType).toBe('image/jpeg');
		expect(result.technical.sha256).toHaveLength(64);
	});

	it('extracts FB2 description, publication data, toc and cover', async () => {
		const cover = btoa('\x89PNG');
		const fb2 = strToU8(`<?xml version="1.0" encoding="utf-8"?>
			<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
			<description><title-info><genre>sf</genre><author><first-name>Аркадий</first-name><last-name>Стругацкий</last-name></author>
			<book-title>Пикник &amp; обочина</book-title><annotation><p>Описание</p></annotation><lang>ru</lang>
			<sequence name="Мир Полудня" number="3"/><coverpage><image l:href="#cover"/></coverpage></title-info>
			<document-info><id>book-uuid</id></document-info><publish-info><publisher>АСТ</publisher><year>1972</year><isbn>978-5-17-000000-0</isbn></publish-info></description>
			<body><section><title><p>Глава первая</p></title><p>Текст</p></section><section><title><p>Глава вторая</p></title></section></body>
			<binary id="cover" content-type="image/png">${cover}</binary></FictionBook>`);

		const result = await extractBookSource(fb2, 'fb2', 'book.fb2');
		const fields = fieldMap(result);
		expect(result.technical.state).toBe('readable');
		expect(fields).toMatchObject({
			title: 'Пикник & обочина',
			author: 'Аркадий Стругацкий',
			publisher: 'АСТ',
			published: '1972',
			series: 'Мир Полудня',
			'series-index': '3',
			description: 'Описание',
			'chapters-total': 2,
			'table-of-contents': ['Глава первая', 'Глава вторая'],
		});
		expect(result.cover?.extension).toBe('png');
	});

	it('extracts PDF metadata and physical page count', async () => {
		const pdf = await PDFDocument.create();
		pdf.setTitle('Книга в PDF');
		pdf.setAuthor('Автор PDF');
		pdf.setSubject('Описание PDF');
		pdf.setKeywords(['история', 'исследование']);
		pdf.addPage();
		pdf.addPage();
		const bytes = await pdf.save();

		const result = await extractBookSource(bytes, 'pdf', 'book.pdf', {
			renderPdfCover: false,
		});
		expect(result.technical.state).toBe('partial');
		expect(fieldMap(result)).toMatchObject({
			title: 'Книга в PDF',
			author: 'Автор PDF',
			description: 'Описание PDF',
			'pages-total': 2,
		});
		expect(result.technical.warnings).toContain('Закладки PDF не найдены');
	});

	it('caps a mobile PDF cover below the pixel and dimension limits', () => {
		const dimensions = pdfCoverDimensions(4_000, 6_000, true);
		expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(1_500_000);
		expect(Math.max(dimensions.width, dimensions.height)).toBeLessThanOrEqual(1_600);
	});

	it('rejects unsafe paths before unpacking an EPUB', async () => {
		const archive = zipSync({ '../outside.txt': strToU8('bad') });
		const result = await extractBookSource(archive, 'epub', 'unsafe.epub');
		expect(result.technical.state).toBe('unreadable');
		expect(result.technical.warnings.join(' ')).toContain('Небезопасный путь');
	});

	it('normalizes MOBI metadata and nested toc from the parser boundary', () => {
		const metadata = mobiMetadataToRaw(
			{
				identifier: 'ISBN 978-1-4028-9462-6',
				title: 'MOBI-книга',
				author: ['Автор'],
				publisher: 'Publisher',
				language: 'ru',
				published: '2020',
				description: 'Описание',
				subject: ['Тема'],
				rights: '',
				contributor: [],
			},
			[
				{
					label: 'Часть 1',
					href: 'one',
					children: [{ label: 'Глава 1', href: 'chapter' }],
				},
			],
		);
		expect(metadata).toMatchObject({
			title: 'MOBI-книга',
			isbn: '9781402894626',
			toc: ['Часть 1', 'Глава 1'],
			chapterCount: 1,
		});
	});
});

describe('book field application', () => {
	it('changes only selected candidates and clones arrays', () => {
		const frontmatter: Record<string, unknown> = {
			title: 'Старое название',
			author: 'Пользовательский автор',
		};
		const contents = ['Глава 1', 'Глава 2'];
		applySelectedBookFields(frontmatter, [
			{
				key: 'title',
				label: 'Название',
				value: 'Новое название',
				origin: 'embedded',
				confidence: 'high',
			},
			{
				key: 'table-of-contents',
				label: 'Содержание',
				value: contents,
				origin: 'structure',
				confidence: 'medium',
			},
		]);
		expect(frontmatter).toEqual({
			title: 'Новое название',
			author: 'Пользовательский автор',
			'table-of-contents': ['Глава 1', 'Глава 2'],
		});
		expect(frontmatter['table-of-contents']).not.toBe(contents);
	});
});
