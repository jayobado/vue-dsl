// Event handling
export { useClickOutside } from './use-click-outside.ts'
export { useEscapeKey } from './use-escape-key.ts'
export { useEventListener } from './use-event-listener.ts'

// Focus and scroll
export { useFocusTrap } from './use-focus-trap.ts'
export { useScrollLock } from './use-scroll-lock.ts'

// Reactive browser state
export { useMediaQuery } from './use-media-query.ts'
export { useLocalStorage } from './use-local-storage.ts'

// Observers
export { useResizeObserver } from './use-resize-observer.ts'
export { useIntersectionObserver } from './use-intersection-observer.ts'

// Timing
export { useDebounce } from './use-debounce.ts'
export { useInterval } from './use-interval.ts'

// Layout helpers
export { useFloating } from './use-floating.ts'
export { usePagination } from './use-pagination.ts'
export { useSelection } from './use-selection.ts'

// Clipboard
export { useClipboard } from './use-clipboard.ts'

// Notifications
export { useToasts, toast } from './use-toasts.ts'

// Types
export type {
	Placement,
	SizeBehavior,
	UseFloatingOptions,
	UseFloatingReturn,
} from './use-floating.ts'

export type {
	Toast,
	ToastKind,
	ToastOptions,
} from './use-toasts.ts'