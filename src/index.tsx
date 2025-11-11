import { createRoot } from 'preact/compat/client'

import { App } from './ui/App'

const init = () => {
	// Find root element
	const rootElem = document.getElementById('root')
	if (!rootElem) {
		console.error('Root element not found')
		return
	}

	// Initialize app
	const root = createRoot(rootElem)
	root.render(<App />)

	return {
		destroy: () => {
			root.unmount()
		},
	}
}

init()
