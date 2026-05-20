import { computed, ref, type Ref } from 'vue'

interface UseSelectionReturn<T> {
	selected: Ref<Set<T>>
	size: Ref<number>
	isEmpty: Ref<boolean>
	has: (item: T) => boolean
	add: (item: T) => void
	remove: (item: T) => void
	toggle: (item: T) => void
	clear: () => void
	set: (items: Iterable<T>) => void
	values: () => T[]
}

/**
 * Manage a set of selected items reactively.
 *
 * @param initial - Optional initial selection.
 * @returns An object with selected (Ref<Set<T>>) and methods.
 *
 * Useful for multi-select tables, checkbox lists, batch actions. Pass to
 * a vue-dsl table via custom row rendering to track selection.
 *
 * Mutations trigger reactivity correctly because we replace the Set on
 * each change (Vue's reactivity tracks ref reassignment, not Set mutation).
 */
export function useSelection<T>(initial?: Iterable<T>): UseSelectionReturn<T> {
	const selected = ref(new Set(initial ?? [])) as Ref<Set<T>>

	const size = computed(() => selected.value.size)
	const isEmpty = computed(() => selected.value.size === 0)

	function has(item: T): boolean {
		return selected.value.has(item)
	}

	function add(item: T): void {
		if (selected.value.has(item)) return
		const next = new Set(selected.value)
		next.add(item)
		selected.value = next
	}

	function remove(item: T): void {
		if (!selected.value.has(item)) return
		const next = new Set(selected.value)
		next.delete(item)
		selected.value = next
	}

	function toggle(item: T): void {
		if (selected.value.has(item)) {
			remove(item)
		} else {
			add(item)
		}
	}

	function clear(): void {
		if (selected.value.size === 0) return
		selected.value = new Set()
	}

	function set(items: Iterable<T>): void {
		selected.value = new Set(items)
	}

	function values(): T[] {
		return Array.from(selected.value)
	}

	return {
		selected,
		size,
		isEmpty,
		has,
		add,
		remove,
		toggle,
		clear,
		set,
		values,
	}
}