import { onScopeDispose, ref, type Ref } from 'vue'

interface UseScrollLockReturn {
	isLocked: Ref<boolean>
	lock: () => void
	unlock: () => void
}

// Module-level state — multiple useScrollLock calls coordinate so the lock
// is only released when all of them release it.
let lockCount = 0

// Saved values from before the first lock
let originalOverflow: string | null = null
let originalPaddingRight: string | null = null

// iOS-specific saved state
let originalPosition: string | null = null
let originalTop: string | null = null
let originalWidth: string | null = null
let savedScrollY: number = 0

const IS_IOS = (() => {
	if (typeof navigator === 'undefined') return false
	return /iP(hone|od|ad)/.test(navigator.userAgent)
		|| (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
})()

function applyLock(): void {
	if (lockCount > 0) return

	const body = document.body
	const html = document.documentElement
	const scrollbarWidth = globalThis.innerWidth - html.clientWidth

	originalOverflow = body.style.overflow
	originalPaddingRight = body.style.paddingRight

	if (IS_IOS) {
		savedScrollY = globalThis.scrollY

		originalPosition = body.style.position
		originalTop = body.style.top
		originalWidth = body.style.width

		body.style.position = 'fixed'
		body.style.top = `-${savedScrollY}px`
		body.style.width = '100%'
		body.style.overflow = 'hidden'
	} else {
		body.style.overflow = 'hidden'
		// Compensate for scrollbar disappearing — prevents layout shift
		if (scrollbarWidth > 0) {
			const currentPadding = parseInt(getComputedStyle(body).paddingRight, 10) || 0
			body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
		}
	}
}

function releaseLock(): void {
	if (lockCount > 0) return

	const body = document.body

	if (IS_IOS) {
		body.style.position = originalPosition ?? ''
		body.style.top = originalTop ?? ''
		body.style.width = originalWidth ?? ''
		body.style.overflow = originalOverflow ?? ''

		// Restore scroll position
		globalThis.scrollTo(0, savedScrollY)

		originalPosition = null
		originalTop = null
		originalWidth = null
		savedScrollY = 0
	} else {
		body.style.overflow = originalOverflow ?? ''
		body.style.paddingRight = originalPaddingRight ?? ''
	}

	originalOverflow = null
	originalPaddingRight = null
}

/**
 * Prevent body scroll.
 *
 * @returns An object with isLocked, lock, and unlock.
 *
 * Multiple useScrollLock instances coordinate — body scroll only unlocks
 * when ALL instances have unlocked. Nested modals correctly keep scroll
 * locked until all are dismissed.
 *
 * On iOS Safari, uses position: fixed + scroll restoration to work around
 * the platform's broken overflow:hidden behavior. The page visually stays
 * put during the lock and scrolls back to its original position on unlock.
 *
 * On scope dispose, the lock is automatically released if it was active.
 */
export function useScrollLock(): UseScrollLockReturn {
	const isLocked = ref(false)

	function lock(): void {
		if (isLocked.value) return
		applyLock()
		lockCount++
		isLocked.value = true
	}

	function unlock(): void {
		if (!isLocked.value) return
		lockCount--
		isLocked.value = false
		releaseLock()
	}

	onScopeDispose(() => {
		if (isLocked.value) {
			unlock()
		}
	})

	return { isLocked, lock, unlock }
}