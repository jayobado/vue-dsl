import { computed, onScopeDispose, ref, watchEffect, type Ref } from 'vue'

export interface QueryOptions<T> {
	enabled?: Ref<boolean> | boolean
	retry?: number
	retryDelay?: number
	onError?: (error: Error) => void
	onSuccess?: (data: T) => void
}

export interface QueryReturn<T> {
	data: Ref<T | undefined>
	error: Ref<Error | null>
	loading: Ref<boolean>
	refetch: () => Promise<void>
}

/**
 * Wrap a Promise-returning function in reactive state.
 *
 * The function is called immediately on setup and again whenever any
 * reactive value it reads changes. Stale results from older invocations
 * are discarded via a generation counter.
 */
export function useQuery<T>(
	fn: () => Promise<T>,
	options: QueryOptions<T> = {},
): QueryReturn<T> {
	const {
		enabled = true,
		retry = 0,
		retryDelay = 1000,
		onError,
		onSuccess,
	} = options

	const data = ref<T | undefined>(undefined) as Ref<T | undefined>
	const error = ref<Error | null>(null)
	const loading = ref(false)

	let generation = 0
	let retryTimer: ReturnType<typeof setTimeout> | null = null

	const isEnabled = computed(() => {
		if (typeof enabled === 'boolean') return enabled
		return enabled.value
	})

	async function executeAttempt(currentGen: number, attempt: number, promise: Promise<T>): Promise<void> {
		try {
			const result = await promise
			if (currentGen !== generation) return

			data.value = result
			error.value = null
			loading.value = false

			if (onSuccess) onSuccess(result)
		} catch (err) {
			if (currentGen !== generation) return

			const normalized = err instanceof Error ? err : new Error(String(err))

			if (onError) onError(normalized)

			if (attempt < retry) {
				retryTimer = setTimeout(() => {
					if (currentGen !== generation) return
					// On retry, re-execute the function (it may produce a new promise
					// reading current reactive state)
					executeAttempt(currentGen, attempt + 1, fn())
				}, retryDelay)
			} else {
				error.value = normalized
				loading.value = false
			}
		}
	}

	// The watchEffect tracks fn's reactive dependencies. When they change,
	// the effect re-runs and fires a fresh execution.
	watchEffect(() => {
		if (!isEnabled.value) {
			loading.value = false
			return
		}

		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}

		generation++
		const currentGen = generation
		loading.value = true

		// Call fn() inside watchEffect so its reactive reads are tracked.
		// The returned promise is handled outside the tracking scope.
		const promise = fn()
		executeAttempt(currentGen, 0, promise)
	})

	async function refetch(): Promise<void> {
		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}

		generation++
		const currentGen = generation
		loading.value = true
		await executeAttempt(currentGen, 0, fn())
	}

	onScopeDispose(() => {
		generation++
		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}
	})

	return {
		data,
		error,
		loading,
		refetch,
	}
}