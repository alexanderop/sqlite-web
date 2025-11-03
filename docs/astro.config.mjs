// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	integrations: [
		mermaid(),
		starlight({
			description: 'Type-safe browser SQLite with WASM, OPFS, and reactive Vue integration', sidebar: [
				{
					items: [
						{ label: 'Introduction', slug: 'index' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
					], label: 'Getting Started',
				},
				{
					items: [
						{ label: 'Overview', slug: 'core/overview' },
						{ label: 'Schema Definition', slug: 'core/schema' },
						{ label: 'Query Builder', slug: 'core/query-builder' },
						{ label: 'Mutations', slug: 'core/mutations' },
						{ label: 'Migrations', slug: 'core/migrations' },
					], label: 'Core Package',
				},
				{
					items: [
						{ label: 'Overview', slug: 'vue/overview' },
						{ label: 'Plugin Setup', slug: 'vue/plugin' },
						{ label: 'Composables', slug: 'vue/composables' },
						{ label: 'Reactive Queries', slug: 'vue/reactive-queries' },
					], label: 'Vue Integration',
				},
				{
					autogenerate: { directory: 'api' }, label: 'API Reference',
				},
				{
					items: [
						{ label: 'Type Safety', slug: 'guides/type-safety' },
						{ label: 'Browser Setup', slug: 'guides/browser-setup' },
						{ label: 'Publishing', slug: 'guides/publishing' },
					], label: 'Guides',
				},
			], social: [
				{ href: 'https://github.com/yourusername/sqlite-web', icon: 'github', label: 'GitHub' }
			], title: 'SQLite Web',
		}),
	],
});
