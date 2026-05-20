import { computed, isRef, ref, type Ref } from 'vue'

interface UsePaginationReturn {
	page: Ref<number>
	pageSize: Ref<number>
	totalRows: Ref<number>
	totalPages: Ref<number>
	canPrev: Ref<boolean>
	canNext: Ref<boolean>
	startIndex: Ref<number>
	endIndex: Ref<number>
	prev: () => void
	next: () => void
	goTo: (page: number) => void
}

type MaybeRef<T> = T | Ref<T>

/**
 * Compute pagination state from current page, total rows, and page size.
 *
 * @param page      - Ref<number> for the current page (1-indexed), or a plain number.
 * @param totalRows - Ref<number> or plain number for total row count.
 * @param pageSize  - Ref<number> or plain number for page size.
 *
 * If the inputs are passed as refs, the computed values stay reactive. If
 * passed as plain numbers, an internal ref is created (for `page`, since
 * it changes on prev/next/goTo) or a static ref (for totalRows/pageSize).
 *
 * Useful when you have pagination UI outside a vue-dsl table — e.g., a
 * custom list view, a calendar grid, etc.
 */
export function usePagination(
	page: MaybeRef<number>,
	totalRows: MaybeRef<number>,
	pageSize: MaybeRef<number>,
): UsePaginationReturn {
	const pageRef = isRef(page) ? page : ref(page)
	const totalRowsRef = isRef(totalRows) ? totalRows : ref(totalRows)
	const pageSizeRef = isRef(pageSize) ? pageSize : ref(pageSize)

	const totalPages = computed(() => {
		const total = totalRowsRef.value
		const size = pageSizeRef.value
		if (total <= 0 || size <= 0) return 0
		return Math.ceil(total / size)
	})

	const canPrev = computed(() => pageRef.value > 1)
	const canNext = computed(() => pageRef.value < totalPages.value)

	const startIndex = computed(() => {
		if (totalRowsRef.value === 0) return 0
		return (pageRef.value - 1) * pageSizeRef.value
	})

	const endIndex = computed(() => {
		if (totalRowsRef.value === 0) return 0
		return Math.min(
			startIndex.value + pageSizeRef.value - 1,
			totalRowsRef.value - 1,
		)
	})

	function prev(): void {
		if (canPrev.value) pageRef.value = pageRef.value - 1
	}

	function next(): void {
		if (canNext.value) pageRef.value = pageRef.value + 1
	}

	function goTo(target: number): void {
		const clamped = Math.max(1, Math.min(target, totalPages.value || 1))
		pageRef.value = clamped
	}

	return {
		page: pageRef,
		pageSize: pageSizeRef,
		totalRows: totalRowsRef,
		totalPages,
		canPrev,
		canNext,
		startIndex,
		endIndex,
		prev,
		next,
		goTo,
	}
}