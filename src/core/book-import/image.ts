const RASTER_EXTENSIONS: Readonly<Record<string, string>> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
};

export function isSafeRasterType(mediaType: string): boolean {
	return mediaType in RASTER_EXTENSIONS;
}

export function imageExtension(mediaType: string): string {
	return RASTER_EXTENSIONS[mediaType] ?? 'bin';
}
