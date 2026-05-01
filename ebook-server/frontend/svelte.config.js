import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html',
    }),
    // vite-plugin-pwa가 SW를 전담하므로 SvelteKit 내장 SW 등록 비활성화
    serviceWorker: {
      register: false,
    },
  },
};

export default config;
