import { onScopeDispose, ref, watch, isRef, type Ref } from 'vue'

/**
 * Debounce a function call.
 *
 * @param fn - The function to debounce.
 * @param ms - Delay in milliseconds.
 * @returns A debounced version of fn. Repeated calls within `ms` reset
 *          the timer; the function executes `ms` after the last call.
 *
 * The pending invocation is canceled on scope dispose.
 */
export function useDebounce<TArgs extends unknown[]>(
	fn: (...args: TArgs) => void,
	ms: number,
): (...args: TArgs) => void

/**
 * Debounce a ref.
 *
 * @param source - A ref to debounce.
 * @param ms     - Delay in milliseconds.
 * @returns A new ref whose value updates `ms` after the source ref last
 *          changed.
 *
 * The pending update is canceled on scope dispose.
 */
export function useDebounce<T>(
	source: Ref<T>,
	ms: number,
): Ref<T>

export function useDebounce<T>(
	target: ((...args: unknown[]) => void) | Ref<T>,
	ms: number,
): unknown {
	if (isRef(target)) {
		return debounceRef(target, ms)
	}
	return debounceFunction(target, ms)
}

function debounceFunction<TArgs extends unknown[]>(
	fn: (...args: TArgs) => void,
	ms: number,
): (...args: TArgs) => void {
	let timer: ReturnType<typeof setTimeout> | null = null

	onScopeDispose(() => {
		if (timer !== null) {
			clearTimeout(timer)
			timer = null
		}
	})

	return (...args: TArgs) => {
		if (timer !== null) clearTimeout(timer)
		timer = setTimeout(() => {
			fn(...args)
			timer = null
		}, ms)
	}
}

function debounceRef<T>(source: Ref<T>, ms: number): Ref<T> {
	const debounced = ref(source.value) as Ref<T>
	let timer: ReturnType<typeof setTimeout> | null = null

	const unwatch = watch(source, (newValue) => {
		if (timer !== null) clearTimeout(timer)
		timer = setTimeout(() => {
			debounced.value = newValue
			timer = null
		}, ms)
	})

	onScopeDispose(() => {
		unwatch()
		if (timer !== null) {
			clearTimeout(timer)
			timer = null
		}
	})

	return debounced
}