import { computed, ref, type Ref } from 'vue'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
	id: string
	message: string
	kind: ToastKind
	duration: number
	createdAt: number
}

export interface ToastOptions {
	kind?: ToastKind
	duration?: number
}

interface ToastsApi {
	toasts: Ref<readonly Toast[]>
	show: (message: string, opts?: ToastOptions) => string
	info: (message: string, opts?: Omit<ToastOptions, 'kind'>) => string
	success: (message: string, opts?: Omit<ToastOptions, 'kind'>) => string
	warning: (message: string, opts?: Omit<ToastOptions, 'kind'>) => string
	error: (message: string, opts?: Omit<ToastOptions, 'kind'>) => string
	dismiss: (id: string) => void
	clear: () => void
}

// ─── Module-level state (singleton) ──────────────────────────────────────

const DEFAULT_DURATION = 3000

const toastsRef = ref<Toast[]>([])
let nextId = 1

const timers = new Map<string, ReturnType<typeof setTimeout>>()

// ─── Internal methods ────────────────────────────────────────────────────

function showImpl(message: string, opts: ToastOptions = {}): string {
	const id = `toast-${nextId++}`
	const kind = opts.kind ?? 'info'
	const duration = opts.duration ?? DEFAULT_DURATION

	const toast: Toast = {
		id,
		message,
		kind,
		duration,
		createdAt: Date.now(),
	}

	toastsRef.value = [...toastsRef.value, toast]

	if (duration > 0) {
		const timer = setTimeout(() => {
			dismissImpl(id)
		}, duration)
		timers.set(id, timer)
	}

	return id
}

function dismissImpl(id: string): void {
	const timer = timers.get(id)
	if (timer) {
		clearTimeout(timer)
		timers.delete(id)
	}
	toastsRef.value = toastsRef.value.filter((t) => t.id !== id)
}

function clearImpl(): void {
	for (const timer of timers.values()) {
		clearTimeout(timer)
	}
	timers.clear()
	toastsRef.value = []
}

// ─── Public API ──────────────────────────────────────────────────────────

const sharedApi: ToastsApi = {
	toasts: computed(() => toastsRef.value) as Ref<readonly Toast[]>,
	show: showImpl,
	info: (msg, opts) => showImpl(msg, { ...opts, kind: 'info' }),
	success: (msg, opts) => showImpl(msg, { ...opts, kind: 'success' }),
	warning: (msg, opts) => showImpl(msg, { ...opts, kind: 'warning' }),
	error: (msg, opts) => showImpl(msg, { ...opts, kind: 'error' }),
	dismiss: dismissImpl,
	clear: clearImpl,
}

/**
 * A composable for accessing toast state and methods.
 *
 * All calls to useToasts share the same module-level state — there is one
 * toast list per app. The composable form is for components that want the
 * reactive `toasts` ref (typically the toast renderer in your app root).
 *
 * For imperative calls from non-component code, use the `toast` singleton
 * instead.
 */
export function useToasts(): ToastsApi {
	return sharedApi
}

/**
 * Imperative toast API for use outside component setup.
 *
 * Use this from API error handlers, route guards, store actions, or
 * anywhere you need to show a toast without being in a component's setup
 * function. Shares state with useToasts.
 */
export const toast = {
	show: showImpl,
	info: (msg: string, opts?: Omit<ToastOptions, 'kind'>) => showImpl(msg, { ...opts, kind: 'info' }),
	success: (msg: string, opts?: Omit<ToastOptions, 'kind'>) => showImpl(msg, { ...opts, kind: 'success' }),
	warning: (msg: string, opts?: Omit<ToastOptions, 'kind'>) => showImpl(msg, { ...opts, kind: 'warning' }),
	error: (msg: string, opts?: Omit<ToastOptions, 'kind'>) => showImpl(msg, { ...opts, kind: 'error' }),
	dismiss: dismissImpl,
	clear: clearImpl,
}