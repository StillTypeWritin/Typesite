// Prefers to show the whole generation container if possible,
// but ensures the loyalist is always visible
export const scrollLoyalistIntoViewInList = (
	containerRef: HTMLDivElement,
	generation: number,
	username: string
) => {
	const genEl = containerRef.querySelector<HTMLElement>(
		`[data-gen-container="${generation}"]`
	)
	if (!genEl) {
		return
	}

	const loyalistEl = genEl.querySelector<HTMLElement>(
		`[data-username="${username}"]`
	)
	if (!loyalistEl) {
		return
	}

	// Measure current layout
	const cRect = containerRef.getBoundingClientRect()
	const gRect = genEl.getBoundingClientRect()
	const lRect = loyalistEl.getBoundingClientRect()
	const margin = 8

	// Find sticky header (if any) for this generation and account for its height
	const stickyHeader = genEl.querySelector<HTMLElement>('[data-gen-header]')
	const stickyHeight = stickyHeader
		? stickyHeader.getBoundingClientRect().height
		: 0

	// Define safe boundaries that respect the sticky header at the top
	const topBoundary = cRect.top + margin + stickyHeight
	const bottomBoundary = cRect.bottom - margin

	// Effective visible height, excluding margins and the header area
	const containerVisibleHeight = cRect.height - 2 * margin - stickyHeight
	const genHeight = gRect.height
	const loyalistHeight = lRect.height

	// Check if loyalist is already fully visible within safe bounds
	const loyalistVisible =
		lRect.top >= topBoundary && lRect.bottom <= bottomBoundary
	if (loyalistVisible) {
		return
	}

	let target: number

	// Strategy: Try to fit the whole generation in view if possible,
	// otherwise ensure the loyalist is visible
	if (genHeight <= containerVisibleHeight) {
		// Try centering the generation
		const genCenterTarget =
			containerRef.scrollTop +
			(gRect.top + gRect.bottom) / 2 -
			(cRect.top + cRect.bottom) / 2

		// Predict loyalist position after centering
		const delta = genCenterTarget - containerRef.scrollTop
		const loyalistTopAfter = lRect.top - delta
		const loyalistBottomAfter = lRect.bottom - delta

		if (
			loyalistTopAfter >= topBoundary &&
			loyalistBottomAfter <= bottomBoundary
		) {
			target = genCenterTarget
		} else {
			// Fall back to scrolling the loyalist into view
			if (lRect.top < topBoundary) {
				// Scroll up a bit more to account for the sticky header
				target = containerRef.scrollTop + (lRect.top - topBoundary)
			} else {
				target = containerRef.scrollTop + (lRect.bottom - bottomBoundary)
			}
		}
	} else {
		// Generation doesn't fit, just ensure loyalist is visible
		if (loyalistHeight > containerVisibleHeight) {
			// Loyalist itself is taller than viewport, align to top safe boundary
			target = containerRef.scrollTop + (lRect.top - topBoundary)
		} else if (lRect.top < topBoundary) {
			// Loyalist is above viewport (scrolling upwards)
			target = containerRef.scrollTop + (lRect.top - topBoundary)
		} else {
			// Loyalist is below viewport
			target = containerRef.scrollTop + (lRect.bottom - bottomBoundary)
		}
	}

	// Clamp target to valid scroll range
	const maxScroll = containerRef.scrollHeight - containerRef.clientHeight
	const clamped = Math.max(0, Math.min(maxScroll, target))

	containerRef.scrollTo({ top: clamped, behavior: 'smooth' })
}
