import { generations } from '../signals'
import { MAX_GEN, MIN_GEN } from '../constants'

let rafId: number | null = null
let currentAnimationTarget: number | null = null

// Debounced hover scheduling
let hoverTimer: number | null = null
let hoverScheduledTarget: number | null = null

const EPSILON = 0.05

const easeInOutCubic = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export function animateGenerationsTo(target: number, duration = 700) {
	// Skip if effectively already at target
	if (Math.abs(generations.value - target) < EPSILON) {
		currentAnimationTarget = null
		return
	}

	// Skip if already animating to this target
	if (
		currentAnimationTarget !== null &&
		Math.abs(currentAnimationTarget - target) < EPSILON
	) {
		return
	}

	// Cancel any existing animation
	if (rafId !== null) {
		cancelAnimationFrame(rafId)
		rafId = null
	}

	currentAnimationTarget = target

	const start = generations.value
	const delta = target - start
	const startTimeRef = { t: 0 }

	const step = (ts: number) => {
		if (!startTimeRef.t) {
			startTimeRef.t = ts
		}
		const elapsed = ts - startTimeRef.t
		const progress = Math.min(1, elapsed / duration)
		const eased = easeInOutCubic(progress)

		generations.value = start + delta * eased

		if (progress < 1) {
			rafId = requestAnimationFrame(step)
		} else {
			rafId = null
			generations.value = target
			currentAnimationTarget = null
		}
	}

	rafId = requestAnimationFrame(step)
}

// Core target calculation used by both click and hover flows
function computeTargetForGeneration(gen: number) {
	// generations is the slider's "Generations" number directly
	return Math.max(MIN_GEN, Math.min(MAX_GEN, gen + 1))
}

// Click-based scroll (kept for reuse if needed)
export function scrollToGeneration(clickedGeneration: number, duration = 700) {
	const targetGenerationsValue = computeTargetForGeneration(clickedGeneration)
	animateGenerationsTo(targetGenerationsValue, duration)
}

// Hover-based debounced pyramid scroll scheduling
export function schedulePyramidScrollToGeneration(
	generation: number,
	delay = 120,
	duration = 700
) {
	const target = computeTargetForGeneration(generation)

	// If we're already at or animating to this target, clear pending and skip
	const alreadyAtTarget =
		Math.abs(generations.value - target) < EPSILON ||
		(currentAnimationTarget !== null &&
			Math.abs(currentAnimationTarget - target) < EPSILON)

	if (alreadyAtTarget) {
		if (hoverTimer !== null) {
			clearTimeout(hoverTimer)
			hoverTimer = null
			hoverScheduledTarget = null
		}
		return
	}

	// If a hover timer exists for a different target, cancel it
	if (
		hoverTimer !== null &&
		hoverScheduledTarget !== null &&
		Math.abs(hoverScheduledTarget - target) >= EPSILON
	) {
		clearTimeout(hoverTimer)
		hoverTimer = null
		hoverScheduledTarget = null
	}

	// Schedule a new hover-triggered animation
	if (hoverTimer === null) {
		hoverScheduledTarget = target
		hoverTimer = window.setTimeout(() => {
			hoverTimer = null
			hoverScheduledTarget = null
			animateGenerationsTo(target, duration)
		}, delay)
	}
}
