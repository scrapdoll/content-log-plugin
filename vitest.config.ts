import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: `${import.meta.dirname}/tests/obsidian.ts`,
		},
	},
});
