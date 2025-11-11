import { useRef } from 'preact/hooks'

import {
	GenerationSegment,
	PYRAMID_CENTER,
	PYRAMID_HALF_BASE,
	PYRAMID_HEIGHT,
	PYRAMID_TOP,
	SPECIAL_WEIGHTS,
} from './Pyramid'
import { hoveredProfile } from '../signals'
import { loyalists } from '../data/loyalists'
import { profilePictures } from '../data/pfp_small'

const PROFILE_SIZE_RATIO = 0.4
const PACKING_FACTOR = 0.9
const ZIGZAG_OFFSET_RATIO = 0.3
const VISIBLE_GENERATIONS = 16

const getProfilePicture = (username: string) =>
	(profilePictures as Record<string, string>)[username]

// Reusable component for a single profile picture with hover handling
const ProfilePicture = ({
	username,
	generation,
	cx,
	cy,
	size,
}: {
	username: string
	generation: number
	cx: number
	cy: number
	size: number
}) => {
	const isHovered = hoveredProfile.value?.username === username

	// If nothing is hovered, opacity is 1
	// If something is hovered, hovered one is 1, others are 0.7
	const opacity =
		hoveredProfile.value?.source === 'list' ? (isHovered ? 1 : 0.7) : 1

	// Apply grayscale filter to non-hovered images only when the hover originated from the list
	const filter =
		hoveredProfile.value?.source === 'list' && !isHovered
			? 'grayscale(100%)'
			: 'none'

	const activate = () => {
		hoveredProfile.value = {
			generation,
			username,
			source: 'pyramid',
		}
		console.log(`Hovering: @${username} (Generation ${generation})`)
	}

	// Track a tap gesture (must be same finger down+up on this icon)
	const groupRef = useRef<SVGGElement>(null)
	const touchRef = useRef<{ id: number | null }>({ id: null })

	return (
		<g
			ref={groupRef}
			role="button"
			tabIndex={0}
			data-pfp="1"
			onMouseEnter={activate}
			onMouseLeave={() => {
				hoveredProfile.value = null
			}}
			onClick={(e) => {
				e.stopPropagation()
				activate()
			}}
			onTouchStart={(e) => {
				if (e.touches.length !== 1) {
					return
				}
				touchRef.current.id = e.touches[0].identifier
			}}
			onTouchEnd={(e) => {
				const tr = touchRef.current
				if (tr.id === null) {
					return
				}
				const changed = e.changedTouches[0]
				// Ensure finger lifted on the same icon
				const endTarget =
					document.elementFromPoint(changed.clientX, changed.clientY) || null
				const sameElement =
					groupRef.current && endTarget
						? groupRef.current.contains(endTarget)
						: false

				// Was the finger over any profile icon at lift time?
				const overAnyIcon =
					endTarget instanceof Element
						? endTarget.closest('[data-pfp="1"]') !== null
						: false

				if (changed.identifier === tr.id && sameElement) {
					// True tap on this icon -> activate
					activate()
				} else if (!overAnyIcon) {
					// Not a true tap, and not over any icon -> clear selection
					hoveredProfile.value = null
				}

				// reset
				touchRef.current.id = null
			}}
			onTouchCancel={() => {
				touchRef.current.id = null
			}}
			style={{ cursor: 'pointer' }}
		>
			<image
				href={getProfilePicture(username)}
				x={cx - size / 2}
				y={cy - size / 2}
				width={size}
				height={size}
				preserveAspectRatio="xMidYMid slice"
				style={{
					clipPath: 'circle(50%)',
					transition: 'opacity 0.2s ease-in-out, filter 0.2s ease-in-out',
				}}
				opacity={opacity}
				filter={filter}
			/>
			{/* Hover ring */}
			{isHovered ? (
				<circle
					cx={cx}
					cy={cy}
					r={size / 2 + 2}
					fill="none"
					stroke="rgb(59, 130, 246)"
					// stroke={
					// 	isHovered ? 'rgb(59, 130, 246)' : 'oklch(27.8% 0.033 256.848)'
					// }
					stroke-width="3"
					style="transition: stroke 0.2s ease-in-out, stroke-width 0.2s ease-in-out;"
				/>
			) : null}
		</g>
	)
}

// Render profiles in a zigzag pattern
const renderZigzagProfiles = (
	segment: GenerationSegment,
	generationAccounts: string[],
	size: number,
	packingFactor: number = PACKING_FACTOR,
	zigzagOffset: number = ZIGZAG_OFFSET_RATIO
) => {
	const centerY = (segment.topY + segment.bottomY) / 2

	// Calculate the width at the center Y position
	const progress = (centerY - PYRAMID_TOP) / PYRAMID_HEIGHT
	const leftX = PYRAMID_CENTER - PYRAMID_HALF_BASE * progress
	const rightX = PYRAMID_CENTER + PYRAMID_HALF_BASE * progress

	// Keep image centers within the trapezoid
	const usableLeft = leftX + size / 2
	const usableRight = rightX - size / 2

	// Pack using the specified factor
	const bandWidth = (usableRight - usableLeft) * packingFactor
	const bandLeft = usableLeft + (usableRight - usableLeft - bandWidth) / 2

	const count = generationAccounts.length
	const step = count > 1 ? bandWidth / (count - 1) : 0

	// Calculate horizontal shift to compensate for zigzag asymmetry
	// When there's an even count, the rightmost is raised, so shift everything left
	const isEvenCount = count % 2 === 0
	const horizontalShift = isEvenCount ? -size * zigzagOffset * 0.5 : 0

	return generationAccounts.map((username, i) => {
		const cx = bandLeft + step * i + horizontalShift
		// Zig-zag: lift even-indexed, lower odd-indexed
		const isEven = (i + 1) % 2 === 0
		const offset = size * zigzagOffset
		const yOffset = isEven ? -offset : +offset
		const cy = centerY + yOffset

		return (
			<ProfilePicture
				key={i}
				username={username}
				generation={segment.generation}
				cx={cx}
				cy={cy}
				size={size}
			/>
		)
	})
}

export const renderProfilePictures = (
	segment: GenerationSegment,
	segIdx: number,
	segments: Array<GenerationSegment>
) => {
	if (segIdx === segments.length - 1) {
		return null
	}

	if (segIdx < segments.length - 1 - VISIBLE_GENERATIONS) {
		return null
	}

	// Get the accounts for this generation (accounts array is 0-indexed)
	const generationAccounts = loyalists[segment.generation - 1]
	if (!generationAccounts || generationAccounts.length === 0) {
		return null
	}

	// Special handling for generation 1
	if (segment.generation === 1) {
		const height = segment.bottomY - segment.topY
		const size = height * 0.2

		// Three rows: 1, 3, 4 loyalists
		const rows = [
			{ count: 1, yOffset: 0.35 },
			{ count: 3, yOffset: 0.6 },
			{ count: 4, yOffset: 0.85 },
		]

		let accountIndex = 0

		return (
			<g key={`pfps-${segIdx}`}>
				{rows.map((row, rowIdx) => {
					const rowY = segment.topY + height * row.yOffset

					// Calculate the width at this Y position
					const progress = (rowY - PYRAMID_TOP) / PYRAMID_HEIGHT
					const leftX = PYRAMID_CENTER - PYRAMID_HALF_BASE * progress
					const rightX = PYRAMID_CENTER + PYRAMID_HALF_BASE * progress

					// Keep image centers within the trapezoid
					const usableLeft = leftX + size / 2
					const usableRight = rightX - size / 2

					const packingRatio = row.count === 1 ? 1.0 : 0.8
					const bandWidth = (usableRight - usableLeft) * packingRatio
					const bandLeft =
						usableLeft + (usableRight - usableLeft - bandWidth) / 2

					const step = row.count > 1 ? bandWidth / (row.count - 1) : 0

					return Array.from({ length: row.count }).map((_, i) => {
						if (accountIndex >= generationAccounts.length) {
							return null
						}

						const username = generationAccounts[accountIndex]
						const cx = row.count === 1 ? PYRAMID_CENTER : bandLeft + step * i
						const cy = rowY

						accountIndex++

						return (
							<ProfilePicture
								key={`${rowIdx}-${i}`}
								username={username}
								generation={segment.generation}
								cx={cx}
								cy={cy}
								size={size}
							/>
						)
					})
				})}
			</g>
		)
	}

	// Generations 2-4 scaled by special weights
	if (segment.generation >= 2 && segment.generation <= 4) {
		const height = segment.bottomY - segment.topY
		const size =
			(height * PROFILE_SIZE_RATIO) / SPECIAL_WEIGHTS[segment.generation - 1]

		// Special case: generation 3 gets larger vertical zigzag
		const zigzagOffset = segment.generation === 3 ? 0.5 : ZIGZAG_OFFSET_RATIO

		return (
			<g key={`pfps-${segIdx}`}>
				{renderZigzagProfiles(
					segment,
					generationAccounts,
					size,
					PACKING_FACTOR,
					zigzagOffset
				)}
			</g>
		)
	}

	// Generations 5+ zigzag pattern
	const height = segment.bottomY - segment.topY
	const size = height * PROFILE_SIZE_RATIO

	return (
		<g key={`pfps-${segIdx}`}>
			{renderZigzagProfiles(segment, generationAccounts, size)}
		</g>
	)
}
