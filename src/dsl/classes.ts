export type ClassValue = string | readonly string[] | null | undefined

/** Combine class values (strings or arrays) into a single space-joined string. */
export function classes(...values: ClassValue[]): string {
	const parts: string[] = []
	for (const v of values) {
		if (!v) continue
		if (typeof v === 'string') parts.push(v)
		else for (const item of v) if (item) parts.push(item)
	}
	return parts.join(' ')
}
