import { generations } from '../signals'
import { MAX_GEN, MIN_GEN } from '../constants'

export const GenerationsSlider = () => {
	const range = Math.max(0, MAX_GEN - MIN_GEN)

	const handleMouseDown = (e: MouseEvent) => {
		const slider = e.currentTarget as HTMLElement

		const updateValue = (clientX: number) => {
			const rect = slider.getBoundingClientRect()
			const x = clientX - rect.left
			const percentage = Math.max(0, Math.min(1, x / rect.width))
			const value = range > 0 ? MIN_GEN + percentage * range : MIN_GEN
			generations.value = value // No rounding
		}

		updateValue(e.clientX)

		const handleMouseMove = (e: MouseEvent) => {
			updateValue(e.clientX)
		}

		const handleMouseUp = () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
	}

	const percentage =
		range > 0 ? ((generations.value - MIN_GEN) / range) * 100 : 0

	return (
		<div class="w-full px-8 pb-8 flex items-center gap-4">
			<label class="text-white text-sm font-medium whitespace-nowrap">
				Generations: {generations.value.toFixed(1)}
			</label>
			<div
				class="flex-1 h-2 bg-gray-700 rounded-lg cursor-pointer relative"
				onMouseDown={handleMouseDown}
			>
				{/* Track fill */}
				<div
					class="absolute h-full bg-blue-500 rounded-lg pointer-events-none"
					style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
				/>
				{/* Thumb */}
				<div
					class="absolute w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none"
					style={{
						left: `${Math.max(0, Math.min(100, percentage))}%`,
						top: '50%',
						transform: 'translate(-50%, -50%)',
					}}
				/>
			</div>
		</div>
	)
}
