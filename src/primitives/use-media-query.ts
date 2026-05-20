import { onScopeDispose, ref, type Ref } from 'vue'

/**
 * A ref tracking whether a media query matches.
 *
 * @param query - A CSS media query string (e.g., '(max-width: 768px)').
 * @returns A Ref<boolean> that updates when the query result changes.
 *
 * Returns false during SSR or when window.matchMedia is unavailable.
 *
 * The underlying MediaQueryList listener is removed on scope dispose.
 */
export function useMediaQuery(query: string): Ref<boolean> {
	const matches = ref(false)

	if (typeof globalThis.matchMedia !== 'function') {
		return matches
	}

	const mql = globalThis.matchMedia(query)
	matches.value = mql.matches

	function onChange(event: MediaQueryListEvent): void {
		matches.value = event.matches
	}

	mql.addEventListener('change', onChange)

	onScopeDispose(() => {
		mql.removeEventListener('change', onChange)
	})

	return matches
}