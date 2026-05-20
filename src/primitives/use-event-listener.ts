import { onScopeDispose, watch, isRef, type Ref } from 'vue'

type EventTargetLike = Window | Document | HTMLElement

type EventListenerTarget =
	| Ref<EventTargetLike | null>
	| EventTargetLike

/**
 * Add an event listener with automatic cleanup on scope dispose.
 *
 * @param target  - A ref to an element, a direct element, or window/document.
 * @param event   - The event name (e.g., 'click', 'resize', 'mousemove').
 * @param handler - The event handler.
 * @param options - Standard addEventListener options (capture, passive, once).
 *
 * If target is a ref, the listener attaches/detaches as the ref's value
 * changes. If the ref becomes null, the listener is removed.
 */
export function useEventListener<K extends keyof WindowEventMap>(
	target: Window,
	event: K,
	handler: (event: WindowEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions,
): void
export function useEventListener<K extends keyof DocumentEventMap>(
	target: Document,
	event: K,
	handler: (event: DocumentEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions,
): void
export function useEventListener<K extends keyof HTMLElementEventMap>(
	target: Ref<HTMLElement | null> | HTMLElement,
	event: K,
	handler: (event: HTMLElementEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions,
): void
export function useEventListener(
	target: EventListenerTarget,
	event: string,
	handler: EventListener,
	options?: boolean | AddEventListenerOptions,
): void {
	let currentTarget: EventTargetLike | null = null

	function attach(t: EventTargetLike | null): void {
		if (t === currentTarget) return
		if (currentTarget) {
			currentTarget.removeEventListener(event, handler, options)
		}
		if (t) {
			t.addEventListener(event, handler, options)
		}
		currentTarget = t
	}

	if (isRef(target)) {
		watch(
			target,
			(t) => { attach(t) },
			{ immediate: true },
		)
	} else {
		attach(target)
	}

	onScopeDispose(() => {
		if (currentTarget) {
			currentTarget.removeEventListener(event, handler, options)
			currentTarget = null
		}
	})
}