import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec,property.test}.ts'],
    globals: true,
  },
});
