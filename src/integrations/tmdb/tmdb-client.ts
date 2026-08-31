import {
	requestUrl,
	type RequestUrlParam,
	type RequestUrlResponse,
} from 'obsidian';
import { errorMessage } from '../../utils/guards';

export type TmdbMediaType = 'movie' | 'tv';
export type TmdbSearchType = TmdbMediaType | 'multi';

const API_BASE_URL = 'https://api.themoviedb.org/3';
const LANGUAGE = 'ru-RU';
const REQUEST_TIMEOUT_MS = 15000;
const V3_API_KEY = /^[a-f\d]{32}$/i;

export async function searchTmdbRaw(
	credential: string,
	query: string,
	searchType: TmdbSearchType,
): Promise<unknown> {
	const response = await tmdbRequest(
		`/search/${searchType}`,
		{
			query,
			language: LANGUAGE,
			include_adult: 'false',
			page: '1',
		},
		credential,
	);
	return response.json;
}

export async function fetchTmdbDetailsRaw(
	credential: string,
	mediaType: TmdbMediaType,
	id: number,
): Promise<unknown> {
	const response = await tmdbRequest(
		`/${mediaType}/${id}`,
		{ language: LANGUAGE, append_to_response: 'credits' },
		credential,
	);
	return response.json;
}

async function tmdbRequest(
	path: string,
	params: Record<string, string>,
	credential: string,
): Promise<RequestUrlResponse> {
	const request = buildTmdbRequest(path, params, credential);
	let response: RequestUrlResponse;
	try {
		response = await sendWithTimeout(request);
	} catch (error) {
		throw new Error(`нет связи с TMDB (${errorMessage(error)})`);
	}
	if (response.status === 401) {
		throw new Error('TMDB отклонил API key / Read Access Token');
	}
	if (response.status !== 200) {
		throw new Error(`TMDB вернул код ${response.status}`);
	}
	return response;
}

export function buildTmdbRequest(
	path: string,
	params: Record<string, string>,
	credential: string,
): RequestUrlParam {
	const search = new URLSearchParams(params);
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (V3_API_KEY.test(credential)) {
		search.set('api_key', credential);
	} else {
		headers.Authorization = `Bearer ${credential}`;
	}
	return {
		url: `${API_BASE_URL}${path}?${search.toString()}`,
		headers,
		throw: false,
	};
}

function sendWithTimeout(params: RequestUrlParam): Promise<RequestUrlResponse> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(
			() => reject(new Error('превышено время ожидания (15 с)')),
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
