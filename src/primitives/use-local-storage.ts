import { onScopeDispose, ref, watch, type Ref } from 'vue'

interface UseLocalStorageOptions<T> {
	/**
	 * Custom serializer. Defaults to JSON.stringify / JSON.parse.
	 */
	serialize?: (value: T) => string
	deserialize?: (raw: string) => T

	/**
	 * If true, listen for `storage` events from other tabs and sync the ref.
	 * Defaults to true.
	 */
	syncAcrossTabs?: boolean
}

/**
 * A ref backed by localStorage.
 *
 * @param key     - The localStorage key.
 * @param initial - Initial value if no value is stored.
 * @param options - Optional serializer and sync config.
 * @returns A Ref<T> that reads/writes localStorage on change.
 *
 * Reads the initial value from localStorage on first call; falls back to
 * `initial` if no value is stored or parsing fails.
 *
 * Writes are synced to localStorage via a watcher. If `syncAcrossTabs` is
 * true (default), the ref also updates when other tabs change the value.
 *
 * Returns an inert ref (always equal to `initial`) during SSR or when
 * localStorage is unavailable.
 */
export function useLocalStorage<T>(
	key: string,
	initial: T,
	options: UseLocalStorageOptions<T> = {},
): Ref<T> {
	const {
		serialize = JSON.stringify,
		deserialize = JSON.parse,
		syncAcrossTabs = true,
	} = options

	const storage = getLocalStorage()
	const stored = storage ? readFromStorage(storage, key, initial, deserialize) : initial
	const value = ref(stored) as Ref<T>

	if (!storage) {
		return value
	}

	// Sync ref writes back to storage
	const unwatch = watch(value, (newValue) => {
		try {
			if (newValue === undefined || newValue === null) {
				storage.removeItem(key)
			} else {
				storage.setItem(key, serialize(newValue))
			}
		} catch {
			// Storage write failed (quota exceeded, private mode, etc.) — ignore
		}
	}, { deep: true })

	// Listen for changes from other tabs
	let onStorageEvent: ((event: StorageEvent) => void) | null = null
	if (syncAcrossTabs && typeof globalThis.addEventListener === 'function') {
		onStorageEvent = (event: StorageEvent) => {
			if (event.key !== key) return
			if (event.storageArea !== storage) return
			if (event.newValue === null) {
				value.value = initial
				return
			}
			try {
				value.value = deserialize(event.newValue)
			} catch {
				// Malformed value from another tab — leave current value
			}
		}
		globalThis.addEventListener('storage', onStorageEvent)
	}

	onScopeDispose(() => {
		unwatch()
		if (onStorageEvent) {
			globalThis.removeEventListener('storage', onStorageEvent)
		}
	})

	return value
}

function getLocalStorage(): Storage | null {
	try {
		if (typeof globalThis.localStorage === 'undefined') return null
		// Test that we can actually write — Safari throws in private mode
		const testKey = '__vue_dsl_test__'
		globalThis.localStorage.setItem(testKey, '')
		globalThis.localStorage.removeItem(testKey)
		return globalThis.localStorage
	} catch {
		return null
	}
}

function readFromStorage<T>(
	storage: Storage,
	key: string,
	initial: T,
	deserialize: (raw: string) => T,
): T {
	const raw = storage.getItem(key)
	if (raw === null) return initial
	try {
		return deserialize(raw)
	} catch {
		return initial
	}
}