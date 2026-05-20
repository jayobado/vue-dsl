import { onScopeDispose, ref, type Ref } from 'vue'

interface UseIntervalReturn {
	isActive: Ref<boolean>
	start: () => void
	stop: () => void
}

interface UseIntervalOptions {
	/**
	 * If true, start the interval immediately. Defaults to true.
	 */
	immediate?: boolean
}

/**
 * Run a function on an interval with automatic cleanup.
 *
 * @param fn      - The function to run.
 * @param ms      - Interval in milliseconds.
 * @param options - Optional config (immediate: start on call, default true).
 * @returns An object with isActive, start, and stop.
 *
 * The interval starts automatically unless `immediate: false`. Stops on
 * scope dispose. Can be started/stopped manually via the returned methods.
 *
 * The function is called on the interval, not immediately on start. If
 * you need an immediate first call, invoke fn() before start() or in
 * addition to it.
 */
export function useInterval(
	fn: () => void,
	ms: number,
	options: UseIntervalOptions = {},
): UseIntervalReturn {
	const { immediate = true } = options

	const isActive = ref(false)
	let timer: ReturnType<typeof setInterval> | null = null

	function start(): void {
		if (isActive.value) return
		timer = setInterval(fn, ms)
		isActive.value = true
	}

	function stop(): void {
		if (!isActive.value) return
		if (timer !== null) {
			clearInterval(timer)
			timer = null
		}
		isActive.value = false
	}

	if (immediate) {
		start()
	}

	onScopeDispose(() => {
		stop()
	})

	return { isActive, start, stop }
}