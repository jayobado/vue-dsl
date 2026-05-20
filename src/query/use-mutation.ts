import { onScopeDispose, ref, type Ref } from 'vue'

export interface MutationOptions<TArgs extends unknown[], TResult> {
	/**
	 * Number of times to retry on failure. Default 0 (no retry).
	 */
	retry?: number

	/**
	 * Delay between retries in ms. Default 1000.
	 */
	retryDelay?: number

	/**
	 * Called on successful completion.
	 */
	onSuccess?: (data: TResult, args: TArgs) => void

	/**
	 * Called on each error, including before retries.
	 */
	onError?: (error: Error, args: TArgs) => void

	/**
	 * Called when the mutation settles (success or final failure).
	 */
	onSettled?: (data: TResult | undefined, error: Error | null, args: TArgs) => void
}

export interface MutationReturn<TArgs extends unknown[], TResult> {
	data: Ref<TResult | undefined>
	error: Ref<Error | null>
	loading: Ref<boolean>
	mutate: (...args: TArgs) => Promise<TResult>
	reset: () => void
}

/**
 * Wrap a Promise-returning function for manual invocation. Unlike useQuery,
 * mutations don't fire automatically — the consumer calls mutate(...args)
 * when they want the function to run.
 *
 * @param fn      - The async function to wrap.
 * @param options - Configuration for retry behavior and callbacks.
 * @returns Reactive { data, error, loading } plus mutate() and reset().
 *
 * mutate() throws on failure (after retries are exhausted). Wrap in
 * try/catch where you want UI-level error handling.
 */
export function useMutation<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
	options: MutationOptions<TArgs, TResult> = {},
): MutationReturn<TArgs, TResult> {
	const {
		retry = 0,
		retryDelay = 1000,
		onSuccess,
		onError,
		onSettled,
	} = options

	const data = ref<TResult | undefined>(undefined) as Ref<TResult | undefined>
	const error = ref<Error | null>(null)
	const loading = ref(false)

	let generation = 0
	let retryTimer: ReturnType<typeof setTimeout> | null = null

	async function attemptOnce(
		args: TArgs,
		currentGen: number,
		attempt: number,
	): Promise<TResult> {
		try {
			const result = await fn(...args)
			if (currentGen !== generation) {
				throw new Error('[vue-dsl] Mutation superseded by a newer call')
			}

			data.value = result
			error.value = null
			loading.value = false

			if (onSuccess) onSuccess(result, args)
			if (onSettled) onSettled(result, null, args)

			return result
		} catch (err) {
			if (currentGen !== generation) {
				throw err
			}

			const normalized = err instanceof Error ? err : new Error(String(err))

			if (onError) onError(normalized, args)

			if (attempt < retry) {
				return new Promise((resolve, reject) => {
					retryTimer = setTimeout(() => {
						if (currentGen !== generation) {
							reject(new Error('[vue-dsl] Mutation superseded'))
							return
						}
						attemptOnce(args, currentGen, attempt + 1)
							.then(resolve, reject)
					}, retryDelay)
				})
			}

			error.value = normalized
			loading.value = false

			if (onSettled) onSettled(undefined, normalized, args)

			throw normalized
		}
	}

	function mutate(...args: TArgs): Promise<TResult> {
		if (loading.value) {
			throw new Error('[vue-dsl] Previous mutation in flight; await or reset before calling again')
		}

		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}

		generation++
		const currentGen = generation
		loading.value = true

		return attemptOnce(args, currentGen, 0)
	}

	function reset(): void {
		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}
		generation++
		data.value = undefined
		error.value = null
		loading.value = false
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
		mutate,
		reset,
	}
}