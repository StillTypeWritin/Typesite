import '../style.css'
import { Pyramid } from './Pyramid'
import { LoyalistList } from './LoyalistList'
import twLogo from '../assets/tw-logo-bw.png'

export const App = () => {
	return (
		<div class="w-screen h-screen flex flex-col md:flex-row bg-gray-900">
			{/* Top-left typewriter logo */}
			<div class="fixed top-4 left-4 z-50">
				<a
					href="https://x.com/StillTypeWritin"
					target="_blank"
					rel="noopener noreferrer"
					title="@StillTypeWritin on X"
					aria-label="Visit @StillTypeWritin on X"
				>
					<img
						src={twLogo}
						alt="Typewriter logo"
						class="h-25 w-25 rounded-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
					/>
				</a>
			</div>

			{/* Pyramid section */}
			<div class="flex flex-col h-1/2 md:h-full md:flex-1">
				<div class="flex-1 flex items-center justify-center p-2 md:p-8">
					<Pyramid />
				</div>

				{/* Slider at the bottom */}
				{/* <GenerationsSlider /> */}
			</div>

			{/* Loyalists list section */}
			<div class="h-[55%] md:h-full">
				<LoyalistList />
			</div>
		</div>
	)
}
