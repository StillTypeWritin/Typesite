/**
 * Generates small WebP profile pictures from pfp/<username>.(jpg|jpeg|png|webp)
 * and writes them into src/data/pfp_small/<username>.webp.
 *
 * Also generates src/data/pfp_small/index.ts with imports and a profilePictures map.
 *
 * Prints warnings for any files in pfp/ that are not referenced by src/data/loyalists.ts.
 *
 * Validates that src/data/displayNames.ts has exactly the entries needed for loyalists.
 *
 * Requires: sharp
 *   Install with: bun add sharp
 */

import { promises as fs } from 'fs'
import path from 'path'

const projectRoot = process.cwd()
const pfpDir = path.join(projectRoot, 'pfp')
const pfpSmallDir = path.join(projectRoot, 'src', 'data', 'pfp_small')
const loyalistsPath = path.join(projectRoot, 'src', 'data', 'loyalists.ts')
const displayNamesPath = path.join(
	projectRoot,
	'src',
	'data',
	'displayNames.ts'
)

const SUPPORTED_EXTS = ['.webp', '.jpg', '.jpeg', '.png']

async function ensureSharp() {
	try {
		const mod = await import('sharp')
		return mod.default || mod
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (err) {
		console.error(
			'This script requires the "sharp" package. Please install it:\n  bun add sharp'
		)
		process.exit(1)
	}
}

async function clearOutputDir() {
	await fs.rm(pfpSmallDir, { recursive: true, force: true }).catch(() => {})
	await fs.mkdir(pfpSmallDir, { recursive: true })
}

async function readLoyalistsFile(): Promise<string> {
	try {
		return await fs.readFile(loyalistsPath, 'utf8')
	} catch (err) {
		console.error(`Failed to read ${loyalistsPath}:`, err)
		process.exit(1)
	}
}

async function readDisplayNamesFile(): Promise<string> {
	try {
		return await fs.readFile(displayNamesPath, 'utf8')
	} catch (err) {
		console.error(`Failed to read ${displayNamesPath}:`, err)
		process.exit(1)
	}
}

function extractLoyalistsArray(code: string): string[][] {
	const marker = 'export const loyalists'
	const startIdx = code.indexOf(marker)
	if (startIdx === -1) {
		throw new Error(
			'Could not find "export const loyalists" in src/data/loyalists.ts'
		)
	}
	const arrayStart = code.indexOf('[', startIdx)
	if (arrayStart === -1) {
		throw new Error('Could not find array start "[" for loyalists')
	}

	// Find matching closing bracket for the top-level array
	let depth = 0
	let i = arrayStart
	for (; i < code.length; i++) {
		const ch = code[i]
		if (ch === '[') {
			depth++
		} else if (ch === ']') {
			depth--
			if (depth === 0) {
				i++ // include the closing bracket
				break
			}
		}
	}
	if (depth !== 0) {
		throw new Error('Unbalanced brackets while parsing loyalists array')
	}

	const arrayCode = code.slice(arrayStart, i)
	// Evaluate as JS (comments and trailing commas are allowed)
	let result: unknown
	try {
		// eslint-disable-next-line no-new-func
		const fn = new Function(`"use strict"; return (${arrayCode});`)
		result = fn()
	} catch (err) {
		throw new Error(
			`Failed to evaluate loyalists array. Ensure it's valid JS array syntax. ${err}`
		)
	}

	if (!Array.isArray(result)) {
		throw new Error('Parsed loyalists is not an array')
	}
	return result as string[][]
}

function extractDisplayNamesObject(code: string): Record<string, string> {
	const marker = 'export const displayNames'
	const startIdx = code.indexOf(marker)
	if (startIdx === -1) {
		throw new Error(
			'Could not find "export const displayNames" in src/data/displayNames.ts'
		)
	}
	const objectStart = code.indexOf('{', startIdx)
	if (objectStart === -1) {
		throw new Error('Could not find object start "{" for displayNames')
	}

	// Find matching closing brace for the top-level object
	let depth = 0
	let i = objectStart
	for (; i < code.length; i++) {
		const ch = code[i]
		if (ch === '{') {
			depth++
		} else if (ch === '}') {
			depth--
			if (depth === 0) {
				i++ // include the closing brace
				break
			}
		}
	}
	if (depth !== 0) {
		throw new Error('Unbalanced braces while parsing displayNames object')
	}

	const objectCode = code.slice(objectStart, i)
	// Evaluate as JS
	let result: unknown
	try {
		// eslint-disable-next-line no-new-func
		const fn = new Function(`"use strict"; return (${objectCode});`)
		result = fn()
	} catch (err) {
		throw new Error(
			`Failed to evaluate displayNames object. Ensure it's valid JS object syntax. ${err}`
		)
	}

	if (typeof result !== 'object' || result === null || Array.isArray(result)) {
		throw new Error('Parsed displayNames is not an object')
	}
	return result as Record<string, string>
}

function flattenUsernames(nested: string[][]): string[] {
	const out: string[] = []
	for (const gen of nested) {
		if (Array.isArray(gen)) {
			for (const u of gen) {
				if (typeof u === 'string') {
					out.push(u)
				}
			}
		}
	}
	return out
}

async function listPfpFiles(): Promise<string[]> {
	try {
		const files = await fs.readdir(pfpDir)
		return files.filter((f) =>
			SUPPORTED_EXTS.includes(path.extname(f).toLowerCase())
		)
	} catch {
		return []
	}
}

async function warnUnusedSourceImages(usernames: string[]): Promise<number> {
	const files = await listPfpFiles()
	if (files.length === 0) {
		return 0
	}

	const nameToFiles = new Map<string, string[]>()
	for (const file of files) {
		const ext = path.extname(file)
		const base = path.basename(file, ext)
		const arr = nameToFiles.get(base) ?? []
		arr.push(file)
		nameToFiles.set(base, arr)
	}

	const usernamesSet = new Set(usernames)
	const unusedFiles: string[] = []

	for (const [base, arr] of nameToFiles) {
		if (!usernamesSet.has(base)) {
			for (const f of arr) {
				unusedFiles.push(`pfp/${f}`)
			}
		}
	}

	if (unusedFiles.length) {
		console.warn(
			`WARNING: Found ${unusedFiles.length} unused source pfp file${
				unusedFiles.length === 1 ? '' : 's'
			} in pfp/ (no matching username in src/data/loyalists.ts):\n${unusedFiles
				.map((p) => ` - ${p}`)
				.join('\n')}`
		)
		console.warn(
			'These files will be ignored when generating src/data/pfp_small/. ' +
				'If they are not needed, consider removing them or adding the username to loyalists.'
		)
	}

	return unusedFiles.length
}

function validateDisplayNames(
	usernames: string[],
	displayNames: Record<string, string>
): { valid: boolean; missing: string[]; extra: string[] } {
	const usernamesSet = new Set(usernames)
	const displayNamesKeys = new Set(Object.keys(displayNames))

	const missing: string[] = []
	const extra: string[] = []

	// Check for missing entries
	for (const username of usernames) {
		if (!displayNamesKeys.has(username)) {
			missing.push(username)
		}
	}

	// Check for extra entries
	for (const key of displayNamesKeys) {
		if (!usernamesSet.has(key)) {
			extra.push(key)
		}
	}

	return {
		valid: missing.length === 0 && extra.length === 0,
		missing,
		extra,
	}
}

async function findSourceImage(username: string): Promise<string | null> {
	for (const ext of SUPPORTED_EXTS) {
		const p = path.join(pfpDir, `${username}${ext}`)
		try {
			await fs.access(p)
			return p
		} catch {}
	}
	return null
}

async function processImages(
	sharp: any,
	usernames: string[]
): Promise<{ processed: number; missing: string[] }> {
	const missing: string[] = []
	let processed = 0

	for (const username of usernames) {
		const src = await findSourceImage(username)
		if (!src) {
			missing.push(username)
			continue
		}
		const dest = path.join(pfpSmallDir, `${username}.webp`)
		await sharp(src)
			.resize(80, 80, { fit: 'cover' })
			.webp({ quality: 80 })
			.toFile(dest)
		processed++
	}

	return { processed, missing }
}

function buildIndexTs(usernames: string[]): string {
	const header = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT.
 * Generated by: bun run generate-pfp
 */
`

	const importLines = usernames
		.map((u, idx) => `import pfp_${idx + 1} from './${u}.webp?no-inline'`)
		.join('\n')

	const entries = usernames
		.map((u, idx) => {
			const key = /^\d/.test(u) ? `'${u}'` : u
			return `\t${key}: pfp_${idx + 1},`
		})
		.join('\n')

	return `${header}${importLines}

export const profilePictures = {
${entries}
}
`
}

async function writeIndexTs(usernames: string[]) {
	const content = buildIndexTs(usernames)
	await fs.writeFile(path.join(pfpSmallDir, 'index.ts'), content, 'utf8')
}

async function main() {
	console.log('> Reading loyalists from:', loyalistsPath)
	const loyalistsCode = await readLoyalistsFile()
	const loyalistsNested = extractLoyalistsArray(loyalistsCode)
	const usernames = Array.from(new Set(flattenUsernames(loyalistsNested))).sort(
		(a, b) => a.localeCompare(b)
	)

	console.log(`> Found ${usernames.length} usernames`)
	if (usernames.length === 0) {
		console.error('No usernames found in loyalists; aborting.')
		process.exit(1)
	}

	console.log('> Reading displayNames from:', displayNamesPath)
	const displayNamesCode = await readDisplayNamesFile()
	const displayNames = extractDisplayNamesObject(displayNamesCode)

	console.log('> Validating displayNames.ts')
	const validation = validateDisplayNames(usernames, displayNames)

	if (!validation.valid) {
		console.error('\nERROR: displayNames.ts validation failed!\n')

		if (validation.missing.length > 0) {
			console.error(
				`Missing ${validation.missing.length} entries in displayNames.ts:`
			)
			for (const username of validation.missing) {
				console.error(`  - ${username}`)
			}
			console.error(
				'\nPlease add these usernames to src/data/displayNames.ts\n'
			)
		}

		if (validation.extra.length > 0) {
			console.error(
				`Found ${validation.extra.length} extra entries in displayNames.ts:`
			)
			for (const username of validation.extra) {
				console.error(`  - ${username}`)
			}
			console.error(
				'\nPlease remove these entries from src/data/displayNames.ts or add them to loyalists.ts\n'
			)
		}

		process.exit(1)
	}

	console.log('> displayNames.ts validation passed')

	console.log('> Clearing output directory:', pfpSmallDir)
	await clearOutputDir()

	// Warn for any files in pfp/ that are not referenced by loyalists
	await warnUnusedSourceImages(usernames)

	const sharp = await ensureSharp()

	console.log('> Processing images to WebP...')
	const { processed, missing } = await processImages(sharp, usernames)

	if (missing.length) {
		console.error(
			`Missing source images for ${missing.length} usernames:\n${missing
				.map((u) => ` - pfp/${u}.{jpg,jpeg,png,webp}`)
				.join('\n')}`
		)
		console.error('Aborting due to missing images.')
		process.exit(1)
	}

	console.log(`> Processed ${processed} images`)

	console.log('> Generating src/data/pfp_small/index.ts')
	await writeIndexTs(usernames)

	console.log('> Done.')
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
