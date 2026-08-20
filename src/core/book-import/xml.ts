import { XMLParser } from 'fast-xml-parser';
import { isRecord } from '../../utils/guards';

export type XmlRecord = Record<string, unknown>;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	removeNSPrefix: true,
	parseTagValue: false,
	parseAttributeValue: false,
	trimValues: true,
	processEntities: true,
	allowBooleanAttributes: true,
});

/** Разбирает локальный XML без обработки объявленных в файле сущностей. */
export function parseBookXml(input: Uint8Array | string): XmlRecord {
	const xml = typeof input === 'string' ? input : decodeXml(input);
	if (/<!ENTITY\s/i.test(xml)) {
		throw new Error('XML с пользовательскими сущностями не поддерживается');
	}
	const parsed: unknown = parser.parse(xml);
	if (!isRecord(parsed)) throw new Error('Некорректный XML');
	return parsed;
}

export function asRecord(value: unknown): XmlRecord | undefined {
	return isRecord(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function records(value: unknown): XmlRecord[] {
	return asArray(value).filter(isRecord);
}

export function child(record: XmlRecord | undefined, key: string): unknown {
	return record?.[key];
}

export function attribute(
	record: XmlRecord | undefined,
	name: string,
): string | undefined {
	const value = record?.[`@_${name}`];
	return typeof value === 'string' ? value.trim() || undefined : undefined;
}

export function nodeText(value: unknown): string {
	const parts: string[] = [];
	collectText(value, parts, 0);
	return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function descendants(record: unknown, key: string): XmlRecord[] {
	const result: XmlRecord[] = [];
	collectDescendants(record, key, result, 0);
	return result;
}

export function scalarTexts(value: unknown): string[] {
	return asArray(value)
		.map((entry) => nodeText(entry))
		.filter(Boolean);
}

function decodeXml(bytes: Uint8Array): string {
	const prefix = new TextDecoder('ascii').decode(bytes.subarray(0, 256));
	const declared = /<\?xml[^>]+encoding=["']([^"']+)["']/i.exec(prefix)?.[1];
	const encoding = declared || (bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8');
	try {
		return new TextDecoder(encoding).decode(bytes);
	} catch {
		return new TextDecoder('utf-8').decode(bytes);
	}
}

function collectText(value: unknown, result: string[], depth: number): void {
	if (depth > 100) return;
	if (typeof value === 'string' || typeof value === 'number') {
		result.push(String(value));
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectText(entry, result, depth + 1);
		return;
	}
	if (!isRecord(value)) return;
	if (typeof value['#text'] === 'string') result.push(value['#text']);
	for (const [key, entry] of Object.entries(value)) {
		if (key === '#text' || key.startsWith('@_')) continue;
		collectText(entry, result, depth + 1);
	}
}

function collectDescendants(
	value: unknown,
	key: string,
	result: XmlRecord[],
	depth: number,
): void {
	if (depth > 100 || result.length >= 1_000) return;
	if (Array.isArray(value)) {
		for (const entry of value) collectDescendants(entry, key, result, depth + 1);
		return;
	}
	if (!isRecord(value)) return;
	for (const [childKey, entry] of Object.entries(value)) {
		if (childKey === key) result.push(...records(entry));
		collectDescendants(entry, key, result, depth + 1);
	}
}
