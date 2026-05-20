import { onScopeDispose } from 'vue'

/**
 * Fire a handler when the Escape key is pressed.
 *
 * @param handler - Called with the KeyboardEvent when Escape is pressed.
 *
 * Listens on the document at the capture phase so handlers fire even when
 * focus is inside elements that would otherwise stop propagation. Cleanup
 * is automatic on scope dispose.
 *
 * Multiple useEscapeKey calls in the same scope each fire independently —
 * the lib doesn't coordinate "innermost wins" semantics. If you need that
 * (e.g., escape closes a popover inside a modal without closing the modal),
 * the caller handles ordering or uses event.stopPropagation() in their
 * handler.
 */
export function useEscapeKey(
	handler: (event: KeyboardEvent) => void,
): void {
	function onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			handler(event)
		}
	}

	document.addEventListener('keydown', onKeyDown, true)

	onScopeDispose(() => {
		document.removeEventListener('keydown', onKeyDown, true)
	})
}