import { useEffect, useRef, useState } from 'preact/hooks'
import { effect } from '@preact/signals'

import { displayNames } from '../data/displayNames'
import { filteredLoyalists, hoveredProfile, searchQuery } from '../signals'
import { schedulePyramidScrollToGeneration } from './scroll'
import { profilePictures } from '../data/pfp_small'
import { loyalists } from '../data/loyalists'
import { scrollLoyalistIntoViewInList } from './scrollLoyalistIntoViewInList'

const totalLoyalistsCount = loyalists.reduce((sum, gen) => sum + gen.length, 0)

// Simple inline SVG icons that inherit currentColor
const IconSearch = ({ size = 18 }: { size?: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="11" cy="11" r="7" />
		<line x1="21" y1="21" x2="16.65" y2="16.65" />
	</svg>
)

const IconClose = ({ size = 18 }: { size?: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<line x1="18" y1="6" x2="6" y2="18" />
		<line x1="6" y1="6" x2="18" y2="18" />
	</svg>
)

export const LoyalistList = () => {
	const containerRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const [searchOpen, setSearchOpen] = useState(false)

	// Auto-focus search when opened
	useEffect(() => {
		if (searchOpen) {
			requestAnimationFrame(() => {
				searchInputRef.current?.focus()
			})
		}
	}, [searchOpen])

	// Auto-scroll the list to ensure the hovered loyalist is visible
	useEffect(() => {
		const dispose = effect(() => {
			const hovered = hoveredProfile.value
			const container = containerRef.current
			if (!hovered || hovered.source !== 'pyramid' || !container) {
				return
			}

			// Use requestAnimationFrame to ensure DOM is ready
			requestAnimationFrame(() => {
				scrollLoyalistIntoViewInList(
					container,
					hovered.generation,
					hovered.username
				)
			})
		})
		return () => dispose()
	}, [])

	// Auto-select first match ONLY when searchQuery changes and is non-empty.
	// When it becomes empty (search closed), scroll the currently hovered loyalist into view.
	useEffect(() => {
		const unsubscribe = searchQuery.subscribe((q) => {
			if (!q || q.trim() === '') {
				// Search was closed - scroll currently hovered loyalist into view if any
				const hovered = hoveredProfile.value
				const container = containerRef.current
				if (hovered && container) {
					// Use requestAnimationFrame to ensure DOM is updated after search close
					requestAnimationFrame(() => {
						scrollLoyalistIntoViewInList(
							container,
							hovered.generation,
							hovered.username
						)
					})
				}
				return
			}
			const filtered = filteredLoyalists.value
			for (let genIndex = 0; genIndex < filtered.length; genIndex++) {
				const accounts = filtered[genIndex]
				if (accounts.length > 0) {
					const generation = genIndex + 1
					const username = accounts[0]
					if (hoveredProfile.value?.username !== username) {
						hoveredProfile.value = { generation, username, source: 'list' }
						schedulePyramidScrollToGeneration(generation)
					}
					return
				}
			}
			// If no results for a non-empty query, clear hover
			hoveredProfile.value = null
		})
		return () => unsubscribe()
	}, [])

	// Handle search input changes
	const onSearchInput = (e: Event) => {
		const target = e.currentTarget as HTMLInputElement
		searchQuery.value = target.value
	}

	// Close search and clear query
	const closeSearch = () => {
		searchQuery.value = ''
		setSearchOpen(false)
	}

	// Use filtered loyalists for rendering; hide generations with no matches
	const filtered = filteredLoyalists.value

	return (
		<div class="w-full md:w-80 h-full bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 flex flex-col">
			{/* Header */}
			<div class="p-4 border-b border-gray-700 relative min-h-[56px]">
				{/* Title bar (slides/fades out) */}
				<div
					class={`absolute inset-4 flex items-center justify-between gap-2 transition-all duration-200 ${
						searchOpen
							? 'opacity-0 -translate-x-2 pointer-events-none'
							: 'opacity-100 translate-x-0'
					}`}
				>
					<h2 class="text-white text-xl font-bold">
						Loyalists{' '}
						<span class="text-gray-400 font-normal text-base">
							({totalLoyalistsCount} total)
						</span>
					</h2>
					<button
						class="shrink-0 w-9 h-9 flex items-center justify-center rounded border border-gray-600 text-gray-200 hover:text-white hover:bg-gray-700"
						onClick={() => setSearchOpen(true)}
						title="Search loyalists"
						aria-label="Search loyalists"
					>
						<IconSearch />
					</button>
				</div>

				{/* Search bar (slides/fades in from right) */}
				<div
					class={`absolute inset-4 flex items-center gap-2 transition-all duration-200 ${
						searchOpen
							? 'opacity-100 translate-x-0'
							: 'opacity-0 translate-x-4 pointer-events-none'
					}`}
				>
					<input
						ref={searchInputRef}
						type="text"
						value={searchQuery.value}
						onInput={onSearchInput}
						placeholder="Search loyalists..."
						class="flex-1 px-3 py-2 rounded bg-gray-700 text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
						onKeyDown={(e) => {
							if ((e as KeyboardEvent).key === 'Escape') {
								closeSearch()
							}
						}}
					/>
					<button
						class="shrink-0 w-9 h-9 flex items-center justify-center rounded border border-gray-600 text-gray-200 hover:text-white hover:bg-gray-700"
						onClick={closeSearch}
						title="Close search"
						aria-label="Close search"
					>
						<IconClose />
					</button>
				</div>

				{/* Floating 1px overlay strip to cover iOS seam under the header */}
				<div
					class="pointer-events-none absolute left-0 right-0 bottom-[-1.5px] h-[1px] bg-gray-700 z-20"
					aria-hidden="true"
				/>
			</div>

			{/* Scrollable list */}
			<div ref={containerRef} class="flex-1 overflow-y-auto">
				{filtered.map((generationFilteredAccounts, genIndex) => {
					if (generationFilteredAccounts.length === 0) {
						return null
					}

					const generation = genIndex + 1

					return (
						<div
							key={generation}
							data-gen-container={generation}
							class="border-b border-gray-700"
						>
							{/* Generation header */}
							<div
								class="px-4 py-2 sticky top-0 z-10 bg-gray-800/80 backdrop-blur-md border-b border-gray-700/50"
								data-gen-header
							>
								<h3 class="text-white text-sm font-semibold">
									Generation {generation}
								</h3>
								<p class="text-gray-400 text-xs">
									{generationFilteredAccounts.length} loyalist
									{generationFilteredAccounts.length !== 1 ? 's' : ''}
								</p>
							</div>

							{/* Loyalists in this generation (filtered) */}
							<div class="p-2">
								{generationFilteredAccounts.map((username) => {
									const isHovered = hoveredProfile.value?.username === username

									const avatar = (profilePictures as Record<string, string>)[
										username
									]
									const displayName =
										(displayNames as Record<string, string>)[username] ??
										username

									const activate = () => {
										hoveredProfile.value = {
											generation,
											username,
											source: 'list',
										}
										schedulePyramidScrollToGeneration(generation)
									}

									return (
										<div
											key={username}
											role="button"
											tabIndex={0}
											data-gen={generation}
											data-username={username}
											class={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
												isHovered
													? 'bg-blue-500 bg-opacity-20 ring-2 ring-blue-500'
													: 'hover:bg-gray-700'
											}`}
											onMouseEnter={activate}
											onClick={activate}
											onMouseLeave={() => {
												hoveredProfile.value = null
											}}
										>
											{/* Avatar */}
											<div class="relative flex-shrink-0">
												<img
													src={avatar}
													alt={username}
													class="w-10 h-10 rounded-full object-cover"
												/>
												{isHovered && (
													<div class="absolute inset-0 rounded-full ring-2 ring-white ring-offset-2 ring-offset-gray-800" />
												)}
											</div>

											{/* Name and username */}
											<div class="flex-1 min-w-0">
												<p
													class={`text-sm font-medium truncate ${
														isHovered ? 'text-white' : 'text-gray-200'
													}`}
												>
													{displayName}
												</p>
												<p
													class={`text-xs truncate ${
														isHovered ? 'text-gray-300' : 'text-gray-400'
													}`}
												>
													@{username}
												</p>
											</div>

											{/* X profile button */}
											<a
												href={`https://x.com/${username}`}
												target="_blank"
												rel="noopener noreferrer"
												title={`Open @${username} on X`}
												aria-label={`Open @${username} on X`}
												onClick={(e) => e.stopPropagation()}
												class="shrink-0 ml-2 w-9 h-9 inline-flex items-center justify-center rounded border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 text-center"
											>
												𝕏
											</a>
										</div>
									)
								})}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
