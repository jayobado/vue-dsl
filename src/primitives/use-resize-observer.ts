import { onScopeDispose, watch, isRef, type Ref } from 'vue'

type ResizeTarget = Ref<HTMLElement | null> | HTMLElement

/**
 * Observe size changes of an element.
 *
 * @param target   - A ref to an HTMLElement, or a direct HTMLElement.
 * @param callback - Called with the ResizeObserverEntry when size changes.
 * @param options  - Optional ResizeObserverOptions (box: 'content-box' |
 *                   'border-box' | 'device-pixel-content-box').
 *
 * Wraps ResizeObserver with automatic cleanup on scope dispose. The
 * observer is reattached if the target ref's value changes.
 *
 * If ResizeObserver is unavailable (very old browsers), the composable
 * does nothing. No error, no callback.
 */
export function useResizeObserver(
	target: ResizeTarget,
	callback: (entry: ResizeObserverEntry) => void,
	options?: ResizeObserverOptions,
): void {
	if (typeof globalThis.ResizeObserver !== 'function') {
		return
	}

	let observer: ResizeObserver | null = null
	let currentEl: HTMLElement | null = null

	function attach(el: HTMLElement | null): void {
		if (el === currentEl) return
		if (observer && currentEl) {
			observer.unobserve(currentEl)
		}
		currentEl = el
		if (el) {
			if (!observer) {
				observer = new ResizeObserver((entries) => {
					for (const entry of entries) {
						callback(entry)
					}
				})
			}
			observer.observe(el, options)
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