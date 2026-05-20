import { onScopeDispose, ref, watch, type Ref } from 'vue'

interface UseFocusTrapReturn {
	active: Ref<boolean>
	activate: () => void
	deactivate: () => void
}

const FOCUSABLE_SELECTORS = [
	'a[href]',
	'area[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'iframe',
	'object',
	'embed',
	'[tabindex]:not([tabindex="-1"])',
	'[contenteditable]:not([contenteditable="false"])',
].join(',')

/**
 * Trap keyboard focus inside an element while active.
 *
 * @param target - A ref to the element to trap focus inside.
 *
 * When active, Tab and Shift+Tab cycle through focusable elements inside
 * the target. Focus is restored to the previously focused element on
 * deactivation.
 *
 * The trap is created inactive. Call activate() when you need trapping
 * (e.g., a modal opens). Call deactivate() when done (e.g., modal closes).
 * The trap is automatically deactivated on scope dispose.
 */
export function useFocusTrap(
	target: Ref<HTMLElement | null>,
): UseFocusTrapReturn {
	const active = ref(false)
	let previouslyFocused: HTMLElement | null = null

	function getFocusableElements(el: HTMLElement): HTMLElement[] {
		const nodes = el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
		return Array.from(nodes).filter((n) => {
			// Filter out hidden elements
			return n.offsetParent !== null || n === document.activeElement
		})
	}

	function onKeyDown(event: KeyboardEvent): void {
		if (!active.value || event.key !== 'Tab') return
		const container = target.value
		if (!container) return

		const focusables = getFocusableElements(container)
		if (focusables.length === 0) {
			event.preventDefault()
			return
		}

		const first = focusables[0]
		const last = focusables[focusables.length - 1]
		const current = document.activeElement as HTMLElement | null

		if (event.shiftKey) {
			// Backward — if at first or outside, wrap to last
			if (current === first || !container.contains(current)) {
				event.preventDefault()
				last.focus()
			}
		} else {
			// Forward — if at last or outside, wrap to first
			if (current === last || !container.contains(current)) {
				event.preventDefault()
				first.focus()
			}
		}
	}

	function activate(): void {
		if (active.value) return
		const container = target.value
		if (!container) return

		previouslyFocused = document.activeElement as HTMLElement | null

		// Focus the first focusable element, or the container itself
		const focusables = getFocusableElements(container)
		if (focusables.length > 0) {
			focusables[0].focus()
		} else {
			// Make container focusable as fallback
			if (!container.hasAttribute('tabindex')) {
				container.setAttribute('tabindex', '-1')
			}
			container.focus()
		}

		document.addEventListener('keydown', onKeyDown, true)
		active.value = true
	}

	function deactivate(): void {
		if (!active.value) return
		document.removeEventListener('keydown', onKeyDown, true)
		active.value = false

		// Restore focus
		if (previouslyFocused && document.body.contains(previouslyFocused)) {
			previouslyFocused.focus()
		}
		previouslyFocused = null
	}

	// If active and target changes to null, deactivate
	watch(target, (el) => {
		if (active.value && !el) {
			deactivate()
		}
	})

	onScopeDispose(() => {
		if (active.value) {
			deactivate()
		}
	})

	return { active, activate, deactivate }
}