import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},
	// Ensure wa-sqlite WASM assets are included in the Cloudflare build output
	assetsInclude: ['**/*.wasm'],
	optimizeDeps: {
		exclude: ['wa-sqlite']
	}
});
