import { computed, ref, type Ref } from 'vue'

interface UseClipboardReturn {
	isSupported: Ref<boolean>
	lastWritten: Ref<string | null>
	write: (text: string) => Promise<void>
	read: () => Promise<string>
}

/**
 * Read from and write to the clipboard.
 *
 * @returns Methods for reading/writing plus reactive state.
 *
 * - `write(text)`  writes text to the clipboard. Resolves on success,
 *                  rejects on failure (permission denied, no clipboard API).
 * - `read()`       reads text from the clipboard. Resolves with the text,
 *                  rejects on failure.
 * - `lastWritten`  tracks the most recent successfully-written text.
 *                  Useful for "Copied!" confirmation UI.
 * - `isSupported`  whether the Clipboard API is available in this context.
 *
 * Clipboard access requires HTTPS (or localhost) and may prompt for
 * permission depending on the browser.
 */
export function useClipboard(): UseClipboardReturn {
	const lastWritten = ref<string | null>(null)

	const isSupported = computed(() => {
		return typeof navigator !== 'undefined'
			&& typeof navigator.clipboard !== 'undefined'
			&& typeof navigator.clipboard.writeText === 'function'
	})

	async function write(text: string): Promise<void> {
		if (!isSupported.value) {
			throw new Error('[vue-dsl] Clipboard API not supported in this context')
		}
		await navigator.clipboard.writeText(text)
		lastWritten.value = text
	}

	async function read(): Promise<string> {
		if (!isSupported.value) {
			throw new Error('[vue-dsl] Clipboard API not supported in this context')
		}
		if (typeof navigator.clipboard.readText !== 'function') {
			throw new Error('[vue-dsl] Clipboard read not supported in this context')
		}
		return await navigator.clipboard.readText()
	}

	return {
		isSupported,
		lastWritten,
		write,
		read,
	}
}