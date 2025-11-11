import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import tailwindcss from '@tailwindcss/vite'

const checkerConfig = checker({
	eslint: {
		lintCommand: 'eslint .',
	},
	typescript: true,
})

export default defineConfig(() => ({
	plugins: [preact(), checkerConfig, tailwindcss()],
	resolve: {
		alias: {
			react: 'preact/compat',
			'react-dom': 'preact/compat',
			'react-dom/test-utils': 'preact/test-utils',
			'react/jsx-runtime': 'preact/jsx-runtime',
			'react-dom/client': 'preact/compat',
			'react-reconciler': 'preact-reconciler',
		},
	},
	server: {
		port: 5800,
	},
	build: {
		outDir: './target',
		emptyOutDir: true, // Clear the output directory before building
	},
}))
