import { onScopeDispose, watch, type Ref } from 'vue'

type ClickOutsideTarget = Ref<HTMLElement | null> | HTMLElement

/**
 * Fire a handler when a click lands outside the target element.
 *
 * @param target  - A ref to an HTMLElement, or a direct HTMLElement.
 * @param handler - Called with the MouseEvent when a click outside fires.
 *
 * The listener is attached to the document. Clicks inside the target
 * (or any of its descendants) do not fire the handler. Cleanup is
 * automatic on scope dispose (component unmount or effectScope disposal).
 *
 * If the target is a ref whose value is null, no listener is active.
 * The listener attaches/detaches as the ref's value changes.
 */
export function useClickOutside(
	target: ClickOutsideTarget,
	handler: (event: MouseEvent) => void,
): void {
	let currentEl: HTMLElement | null = null

	function onDocumentClick(event: MouseEvent): void {
		if (!currentEl) return
		const targetNode = event.target as Node | null
		if (!targetNode) return
		if (currentEl.contains(targetNode)) return
		handler(event)
	}

	function attach(el: HTMLElement | null): void {
		if (el === currentEl) return
		if (currentEl && !el) {
			document.removeEventListener('click', onDocumentClick, true)
		} else if (!currentEl && el) {
			document.addEventListener('click', onDocumentClick, true)
		}
		currentEl = el
	}

	if (isRef(target)) {
		// Track ref changes — attach/detach as the element appears or disappears
		watch(
			target,
			(el) => { attach(el) },
			{ immediate: true },
		)
	} else {
		attach(target)
	}

	onScopeDispose(() => {
		if (currentEl) {
			document.removeEventListener('click', onDocumentClick, true)
			currentEl = null
		}
	})
}

function isRef<T>(value: unknown): value is Ref<T> {
	return typeof value === 'object' && value !== null && '__v_isRef' in value
}