import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import { errorMessage, finiteNumberOrNull } from '../utils/guards';

/** Игра из результатов поиска HowLongToBeat. */
export interface HltbGame {
	id: number;
	name: string;
	/** Абсолютная ссылка на обложку на CDN сайта. */
	imageUrl: string;
	platforms: string;
	year: number | null;
	/** Времена прохождения в часах, округлённые до 0.1. */
	mainHours: number | null;
	extraHours: number | null;
	completeHours: number | null;
}

const BASE_URL = 'https://howlongtobeat.com';
// API и CDN отдают данные только «браузерным» клиентам, поэтому шлём UA Chrome.
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 15000;

interface BleedSecurity {
	token: string;
	hpKey: string;
	hpVal: string;
}

interface HltbApiGame {
	game_id?: unknown;
	game_name?: unknown;
	game_image?: unknown;
	profile_platform?: unknown;
	release_world?: unknown;
	comp_main?: unknown;
	comp_plus?: unknown;
	comp_100?: unknown;
}

/**
 * Поиск игр на howlongtobeat.com. Сайт закрывает анонимный поиск слоем
 * «bleed»: сначала выдаётся токен ( /api/bleed/init ), затем сам запрос
 * поиска уходит POST-ом в /api/bleed с этим токеном.
 */
export async function searchHowLongToBeat(
	query: string,
): Promise<HltbGame[]> {
	const terms = query.trim().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];

	const referer = `${BASE_URL}/?q=${encodeURIComponent(query.trim())}`;
	const security = await requestSecurity(referer);

	// Форма повторяет тело запроса самого сайта; body[hpKey] обязателен.
	const body: Record<string, unknown> = {
		searchType: 'games',
		searchTerms: terms,
		searchPage: 1,
		size: 20,
		searchOptions: {
			games: {
				userId: 0,
				platform: '',
				sortCategory: 'popular',
				rangeCategory: 'main',
				rangeTime: { min: null, max: null },
				gameplay: {
					perspective: '',
					flow: '',
					genre: '',
					difficulty: '',
				},
				rangeYear: { min: '', max: '' },
				modifier: '',
			},
			users: { sortCategory: 'postcount' },
			lists: { sortCategory: 'follows' },
			filter: '',
			sort: 0,
			randomizer: 0,
		},
		useCache: true,
	};
	body[security.hpKey] = security.hpVal;

	let response = await sendSearch(referer, security, body);
	if (response.status === 403) {
		// Сайт отвечает 403 на «просроченный» токен — сам сайт в этом
		// случае обновляет токен и повторяет запрос; делаем так же.
		const refreshed = await requestSecurity(referer);
		delete body[security.hpKey];
		body[refreshed.hpKey] = refreshed.hpVal;
		response = await sendSearch(referer, refreshed, body);
	}
	if (response.status !== 200) {
		throw new Error(`поиск отклонён сайтом ( код ${response.status} )`);
	}
	const games = (response.json as { data?: unknown } | null)?.data;
	if (!Array.isArray(games)) return [];
	return games
		.map(hltbGameFromApi)
		.filter((game): game is HltbGame => game !== null);
}

function sendSearch(
	referer: string,
	security: BleedSecurity,
	body: Record<string, unknown>,
): Promise<RequestUrlResponse> {
	return sendWithTimeout({
		url: `${BASE_URL}/api/bleed`,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-auth-token': security.token,
			'x-hp-key': security.hpKey,
			'x-hp-val': security.hpVal,
			Origin: BASE_URL,
			...browserHeaders(referer),
		},
		body: JSON.stringify(body),
		throw: false,
	});
}

export function hltbGameUrl(id: number): string {
	return `${BASE_URL}/game/${id}`;
}

async function requestSecurity(referer: string): Promise<BleedSecurity> {
	let response: RequestUrlResponse;
	try {
		response = await sendWithTimeout({
			url: `${BASE_URL}/api/bleed/init?t=${Date.now()}`,
			headers: browserHeaders(referer),
			throw: false,
		});
	} catch (error) {
		throw new Error(
			`нет связи с howlongtobeat.com ( ${errorMessage(error)} )`,
		);
	}
	if (response.status !== 200) {
		throw new Error(`сайт не выдал токен поиска ( код ${response.status} )`);
	}
	const security = response.json as BleedSecurity | null;
	if (
		!security ||
		typeof security.token !== 'string' ||
		typeof security.hpKey !== 'string' ||
		typeof security.hpVal !== 'string' ||
		!security.token ||
		!security.hpKey ||
		!security.hpVal
	) {
		throw new Error('сайт вернул некорректный токен поиска');
	}
	return security;
}

/**
 * requestUrl не имеет таймаута и может «зависнуть» молча — гоним с
 * ограничением по времени, чтобы пользователь видел ошибку, а не вечный
 * «Поиск…».
 */
function sendWithTimeout(params: RequestUrlParam): Promise<RequestUrlResponse> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(
			() => reject(new Error('превышено время ожидания ( 15 с )')),
			REQUEST_TIMEOUT_MS,
		);
		requestUrl(params).then(
			(response) => {
				window.clearTimeout(timer);
				resolve(response);
			},
			(error: unknown) => {
				window.clearTimeout(timer);
				reject(
					error instanceof Error ? error : new Error(String(error)),
				);
			},
		);
	});
}

function browserHeaders(referer: string): Record<string, string> {
	return {
		'User-Agent': USER_AGENT,
		Accept: '*/*',
		'Accept-Language': 'en-US,en;q=0.9',
		Referer: referer,
	};
}

function hltbGameFromApi(value: unknown): HltbGame | null {
	if (typeof value !== 'object' || value === null) return null;
	const game = value as HltbApiGame;
	const id = finiteNumberOrNull(game.game_id);
	const name = typeof game.game_name === 'string' ? game.game_name : '';
	if (id === null || !name) return null;
	const image =
		typeof game.game_image === 'string'
			? game.game_image.replace(/^\/+/, '').replace(/^games\//, '')
			: '';
	return {
		id,
		name,
		imageUrl: `${BASE_URL}/games/${image}`,
		platforms:
			typeof game.profile_platform === 'string'
				? game.profile_platform
				: '',
		year: finiteNumberOrNull(game.release_world),
		mainHours: secondsToHours(game.comp_main),
		extraHours: secondsToHours(game.comp_plus),
		completeHours: secondsToHours(game.comp_100),
	};
}

function secondsToHours(value: unknown): number | null {
	const seconds = finiteNumberOrNull(value);
	if (seconds === null || seconds <= 0) return null;
	return Math.round((seconds / 3600) * 10) / 10;
}
