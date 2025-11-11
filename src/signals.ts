import { computed, signal } from '@preact/signals'

import { loyalists } from './data/loyalists'
import { displayNames } from './data/displayNames'

export const generations = signal(4)
export const generationsInPyramid = computed(() => generations.value + 1)
export const hoveredProfile = signal<{
	generation: number
	username: string
	source: 'pyramid' | 'list'
} | null>(null)
export const searchQuery = signal('')
export const filteredLoyalists = computed(() => {
	const q = searchQuery.value.trim().toLowerCase()
	return loyalists.map((genAccounts) =>
		genAccounts.filter((u) => {
			const name = (
				(displayNames as Record<string, string>)[u] ?? ''
			).toLowerCase()
			return u.toLowerCase().includes(q) || name.includes(q)
		})
	)
})
