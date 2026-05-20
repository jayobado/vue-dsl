import { onScopeDispose, watch, isRef, type Ref } from 'vue'

type IntersectionTarget = Ref<HTMLElement | null> | HTMLElement

/**
 * Observe an element's intersection with a target (typically the viewport).
 *
 * @param target   - A ref to an HTMLElement, or a direct HTMLElement.
 * @param callback - Called with the IntersectionObserverEntry on change.
 * @param options  - Optional IntersectionObserverInit (root, rootMargin,
 *                   threshold).
 *
 * Wraps IntersectionObserver with automatic cleanup on scope dispose. The
 * observer is reattached if the target ref's value changes.
 *
 * If IntersectionObserver is unavailable (very old browsers), the
 * composable does nothing. No error, no callback.
 *
 * Common uses: infinite scroll triggers, lazy-loaded images, sticky-when-
 * scrolled-past patterns, viewport-aware animations.
 */
export function useIntersectionObserver(
	target: IntersectionTarget,
	callback: (entry: IntersectionObserverEntry) => void,
	options?: IntersectionObserverInit,
): void {
	if (typeof globalThis.IntersectionObserver !== 'function') {
		return
	}

	let observer: IntersectionObserver | null = null
	let currentEl: HTMLElement | null = null

	function attach(el: HTMLElement | null): void {
		if (el === currentEl) return
		if (observer && currentEl) {
			observer.unobserve(currentEl)
		}
		currentEl = el
		if (el) {
			if (!observer) {
				observer = new IntersectionObserver((entries) => {
					for (const entry of entries) {
						callback(entry)
					}
				}, options)
			}
			observer.observe(el)
		}
	}

	if (isRef(target)) {
		watch(
			target,
			(el) => { attach(el) },
			{ immediate: true },
		)
	} else {
		attach(target)
	}

	onScopeDispose(() => {
		if (observer) {
			observer.disconnect()
			observer = null
			currentEl = null
		}
	})
}