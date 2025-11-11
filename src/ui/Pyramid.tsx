import { computed } from '@preact/signals'
import { useRef } from 'preact/hooks'

import { generations, generationsInPyramid, hoveredProfile } from '../signals'
import '../style.css'
import { renderProfilePictures } from './renderProfilePictures'
import { animateGenerationsTo } from './scroll'
import { MAX_GEN, MIN_GEN, OVERSCROLL_FACTOR } from '../constants'

const PYRAMID_WIDTH = 1000
export const PYRAMID_TOP = 0
const PYRAMID_BOTTOM = 800
export const PYRAMID_HEIGHT = PYRAMID_BOTTOM - PYRAMID_TOP
export const PYRAMID_CENTER = PYRAMID_WIDTH / 2
const PYRAMID_LEFT = 0
const PYRAMID_RIGHT = PYRAMID_WIDTH
export const PYRAMID_HALF_BASE = PYRAMID_WIDTH / 2
const CLIP_RATIO = 0.8
const VISIBLE_PYRAMID_LEFT = PYRAMID_CENTER - CLIP_RATIO * PYRAMID_CENTER
const VISIBLE_PYRAMID_RIGHT = PYRAMID_CENTER + CLIP_RATIO * PYRAMID_CENTER
const CLIP_HEIGHT = PYRAMID_TOP + PYRAMID_HEIGHT * CLIP_RATIO

// Interaction constants
const WHEEL_SCALE = 0.002 // generation units per wheel deltaY
const TOUCH_SCALE = 0.015 // generation units per pixel of vertical drag

// Weights to enlarge the first few generations
export const SPECIAL_WEIGHTS = [2.0, 1.0, 1.2, 1.0]

// Limit how many generation labels to show (latest N)
const LABELS_VISIBLE_LIMIT = 15

// Roman numeral helper
function toRoman(num: number): string {
	if (num <= 0) {
		return ''
	}
	const map: Array<{ value: number; numeral: string }> = [
		{ value: 1000, numeral: 'M' },
		{ value: 900, numeral: 'CM' },
		{ value: 500, numeral: 'D' },
		{ value: 400, numeral: 'CD' },
		{ value: 100, numeral: 'C' },
		{ value: 90, numeral: 'XC' },
		{ value: 50, numeral: 'L' },
		{ value: 40, numeral: 'XL' },
		{ value: 10, numeral: 'X' },
		{ value: 9, numeral: 'IX' },
		{ value: 5, numeral: 'V' },
		{ value: 4, numeral: 'IV' },
		{ value: 1, numeral: 'I' },
	]
	let res = ''
	for (const { value, numeral } of map) {
		while (num >= value) {
			res += numeral
			num -= value
		}
	}
	return res
}

// Compute normalized segment heights for a pyramid of n generations,
// honoring the rule:
// - For n <= 5: weights are applied to the first three segments and normalized to fill full height
// - For n > 5: previous (n-1) segments keep their relative proportions but are compressed
//              into the top CLIP_RATIO of the height, and generation n takes the bottom (1 - CLIP_RATIO)
const heightsCache = new Map<number, number[]>()

const computeSegmentHeights = (n: number): number[] => {
	if (heightsCache.has(n)) {
		return heightsCache.get(n)!
	}

	let heights: number[]

	if (n <= 4) {
		// Apply weights to first three segments, 1.0 for the rest
		const weights = Array.from(
			{ length: n },
			(_, idx) => SPECIAL_WEIGHTS[idx] ?? 1
		)
		const sum = weights.reduce((a, b) => a + b, 0)
		heights = sum > 0 ? weights.map((w) => w / sum) : weights
	} else {
		// Compress previous generations into top CLIP_RATIO, add a fixed bottom slice
		const prev = computeSegmentHeights(n - 1)
		const top = prev.map((h) => h * CLIP_RATIO)
		const bottom = 1 - CLIP_RATIO
		heights = [...top, bottom]
	}

	heightsCache.set(n, heights)
	return heights
}

// Calculate the relative position (0 to 1) of generation boundary m (between m and m+1) in a pyramid of N generations.
const getGenerationPosition = (m: number, n: number): number => {
	if (m <= 0) {
		return 0
	}
	if (m >= n) {
		return 1
	}

	const heights = computeSegmentHeights(n)
	let acc = 0
	for (let i = 0; i < m; i++) {
		acc += heights[i]
	}
	return acc
}

const computeLines = () => {
	const numGenerations = generationsInPyramid.value
	if (numGenerations <= 1) {
		return []
	}

	const result: Array<{ y: number; leftX: number; rightX: number }> = []
	const fullGenerations = Math.floor(numGenerations)
	const partialProgress = numGenerations - fullGenerations

	// If we're transitioning to a new generation (e.g., 5.3 means 30% into adding gen 6)
	const isTransitioning = partialProgress > 0
	const targetGenCount = isTransitioning ? fullGenerations + 1 : fullGenerations

	// Draw lines between generations
	for (let i = 1; i < targetGenCount; i++) {
		let position

		if (isTransitioning && i === fullGenerations) {
			// Interpolate between positions in current vs next pyramid
			const posInCurrent = getGenerationPosition(i, fullGenerations)
			const posInNext = getGenerationPosition(i, fullGenerations + 1)
			position = posInCurrent + (posInNext - posInCurrent) * partialProgress
		} else {
			// Existing generations - interpolate their compression
			const posInCurrent = getGenerationPosition(i, fullGenerations)
			const posInNext = getGenerationPosition(i, targetGenCount)
			position = posInCurrent + (posInNext - posInCurrent) * partialProgress
		}

		const y = PYRAMID_TOP + PYRAMID_HEIGHT * position

		const progress = (y - PYRAMID_TOP) / PYRAMID_HEIGHT
		const leftX = PYRAMID_CENTER - PYRAMID_HALF_BASE * progress
		const rightX = PYRAMID_CENTER + PYRAMID_HALF_BASE * progress

		result.push({ y, leftX, rightX })
	}

	return result
}

export type GenerationSegment = {
	generation: number
	points: string
	topY: number
	bottomY: number
	topLeftX: number
	topRightX: number
	bottomLeftX: number
	bottomRightX: number
}

// Calculate generation segments (polygons)
const segmentsComputed = computed<GenerationSegment[]>(() => {
	const numGenerations = generationsInPyramid.value
	const targetGenCount = Math.ceil(numGenerations)

	const result: GenerationSegment[] = []
	const lineValues = computeLines()

	for (let gen = 1; gen <= targetGenCount; gen++) {
		// Get top and bottom Y positions for this generation
		let topY: number
		let bottomY: number
		let topLeftX: number
		let topRightX: number
		let bottomLeftX: number
		let bottomRightX: number

		if (gen === 1) {
			// First generation starts at the pyramid top
			topY = PYRAMID_TOP
			topLeftX = PYRAMID_CENTER
			topRightX = PYRAMID_CENTER
		} else {
			// Use the line above this generation
			const lineAbove = lineValues[gen - 2]
			topY = lineAbove.y
			topLeftX = lineAbove.leftX
			topRightX = lineAbove.rightX
		}

		if (gen === targetGenCount) {
			// Last generation ends at the pyramid bottom
			bottomY = PYRAMID_BOTTOM
			bottomLeftX = PYRAMID_LEFT
			bottomRightX = PYRAMID_RIGHT
		} else {
			// Use the line below this generation
			const lineBelow = lineValues[gen - 1]
			bottomY = lineBelow.y
			bottomLeftX = lineBelow.leftX
			bottomRightX = lineBelow.rightX
		}

		// Create polygon points: top-left, top-right, bottom-right, bottom-left
		const points = `${topLeftX},${topY} ${topRightX},${topY} ${bottomRightX},${bottomY} ${bottomLeftX},${bottomY}`

		result.push({
			generation: gen,
			points,
			topY,
			bottomY,
			topLeftX,
			topRightX,
			bottomLeftX,
			bottomRightX,
		})
	}

	return result
})

const applyOverscroll = (desired: number, min: number, max: number) => {
	if (desired < min) {
		const overshoot = min - desired
		return min - overshoot * OVERSCROLL_FACTOR
	}
	if (desired > max) {
		const overshoot = desired - max
		return max + overshoot * OVERSCROLL_FACTOR
	}
	return desired
}

const clampToBounds = (v: number) => Math.max(MIN_GEN, Math.min(MAX_GEN, v))

type PyramidSegmentProps = {
	segmentIndex: number
}

// Single segment component: renders polygon, line, profile pictures, and label
const PyramidSegment = ({ segmentIndex }: PyramidSegmentProps) => {
	const segments = segmentsComputed.value
	const segment = segments[segmentIndex]
	if (!segment) {
		return null
	}

	const labelStartIdx = Math.max(0, segments.length - LABELS_VISIBLE_LIMIT - 1)
	const showLabel = segmentIndex >= labelStartIdx

	// Label position (outside right edge)
	let labelEl: preact.JSX.Element | null = null
	if (showLabel) {
		const labelY = (segment.topY + segment.bottomY) / 2
		const progress = (labelY - PYRAMID_TOP) / PYRAMID_HEIGHT
		const rawRightEdgeX = PYRAMID_CENTER + PYRAMID_HALF_BASE * progress
		const edgeX = Math.min(rawRightEdgeX, VISIBLE_PYRAMID_RIGHT)
		const gap = 12
		const labelX = edgeX + gap

		labelEl = (
			<text
				x={labelX}
				y={labelY}
				fill="rgba(255, 255, 255, 0.9)"
				textAnchor="start"
				dominantBaseline="middle"
				style={{
					fontSize: '28px',
					pointerEvents: 'none',
				}}
				opacity={0.9}
			>
				{`Gen ${toRoman(segment.generation)}`}
			</text>
		)
	}

	return (
		<g>
			<polygon
				points={segment.points}
				fill={'rgb(40, 40, 40, 1)'}
				opacity="0.3"
				stroke="white"
				stroke-width="1"
			/>
			<line
				x1={segment.bottomLeftX}
				y1={segment.bottomY}
				x2={segment.bottomRightX}
				y2={segment.bottomY}
				stroke="white"
				stroke-width="2"
				opacity="0.9"
			/>

			{/* Profile pictures for this segment */}
			{renderProfilePictures(segment, segmentIndex, segments)}

			{/* Generation label */}
			{labelEl}
		</g>
	)
}

const Segments = () => (
	<>
		{segmentsComputed.value.map((seg, i) => (
			<PyramidSegment segmentIndex={i} key={seg.generation} />
		))}
	</>
)

export const Pyramid = () => {
	// Touch interaction state
	const touchState = useRef<{
		active: boolean
		startY: number
		startValue: number
	}>({ active: false, startY: 0, startValue: generations.value })

	// Wheel snap-back timer for overscroll
	const wheelSnapTimer = useRef<number | null>(null)

	const onWheel = (e: WheelEvent) => {
		// Prevent page scroll while zooming/scrolling the pyramid
		e.preventDefault()
		const delta = e.deltaY
		const desired = generations.value + delta * WHEEL_SCALE
		const next = applyOverscroll(desired, MIN_GEN, MAX_GEN)
		generations.value = next

		// If we're overscrolled, schedule a snap back to bounds after wheel idle
		if (next < MIN_GEN || next > MAX_GEN) {
			if (wheelSnapTimer.current !== null) {
				clearTimeout(wheelSnapTimer.current)
			}
			wheelSnapTimer.current = window.setTimeout(() => {
				wheelSnapTimer.current = null
				const target = next < MIN_GEN ? MIN_GEN : MAX_GEN
				animateGenerationsTo(target, 250)
			}, 250)
		} else if (wheelSnapTimer.current !== null) {
			// Cancel pending snap if we returned to bounds
			clearTimeout(wheelSnapTimer.current)
			wheelSnapTimer.current = null
		}
	}

	const onTouchStart = (e: TouchEvent) => {
		if (e.touches.length !== 1) {
			return
		}
		// Prevent native page scroll
		e.preventDefault()
		const t = e.touches[0]
		touchState.current = {
			active: true,
			startY: t.clientY,
			startValue: generations.value,
		}
	}

	const onTouchMove = (e: TouchEvent) => {
		if (!touchState.current.active || e.touches.length !== 1) {
			return
		}
		e.preventDefault()
		const t = e.touches[0]
		const dy = touchState.current.startY - t.clientY // drag up -> positive
		const delta = dy * TOUCH_SCALE
		const desired = touchState.current.startValue + delta
		const next = applyOverscroll(desired, MIN_GEN, MAX_GEN)
		generations.value = next
	}

	const endTouch = () => {
		if (!touchState.current.active) {
			return
		}
		touchState.current.active = false
		// Snap to nearest integer and clamp to allowed bounds
		const target = clampToBounds(Math.round(generations.value))
		animateGenerationsTo(target, 300)
	}

	const onTouchEnd = (e: TouchEvent) => {
		// If we’re not lifting over any profile icon, clear selection
		if (e.changedTouches.length > 0) {
			const t = e.changedTouches[0]
			const endTarget = document.elementFromPoint(t.clientX, t.clientY) || null
			const overAnyIcon =
				endTarget instanceof Element
					? endTarget.closest('[data-pfp="1"]') !== null
					: false
			if (!overAnyIcon) {
				hoveredProfile.value = null
			}
		}
		endTouch()
	}
	const onTouchCancel = () => endTouch()

	return (
		<div class="w-full h-full flex items-center justify-center overflow-hidden cq-container">
			<div
				class="square-grow relative top-[-20%]"
				onWheel={onWheel}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				onTouchCancel={onTouchCancel}
				style={{
					// Prevent browser scroll and improve touch/trackpad behavior inside the pyramid
					touchAction: 'none',
					overscrollBehavior: 'contain',
				}}
			>
				<svg
					viewBox="100 -50 900 480"
					class="w-full h-full aspect-square"
					preserveAspectRatio="xMidYMid meet"
				>
					<Segments />

					{/* Pyramid outline */}
					<polygon
						points={`${PYRAMID_CENTER},${PYRAMID_TOP} ${VISIBLE_PYRAMID_LEFT},${CLIP_HEIGHT} ${VISIBLE_PYRAMID_RIGHT},${CLIP_HEIGHT}`}
						fill="none"
						stroke="white"
						stroke-width="4"
						opacity="0.9"
					/>
				</svg>
			</div>
		</div>
	)
}
