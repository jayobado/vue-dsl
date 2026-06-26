// dsl/table/use-table.ts

import { computed, effectScope, h, onScopeDispose, type VNode, type Ref } from 'vue'
import type {
	TableNode,
	ColumnDef,
	SortState,
	PaginationInfo,
	TableEngine,
	UseTableReturn,
} from './types.ts'
import type { ClassValue } from '../form/types.ts'

// ─── Class helper ────────────────────────────────────────────────────────

function classProp(...values: Array<ClassValue | undefined>): string {
	const parts: string[] = []
	for (const v of values) {
		if (!v) continue
		if (typeof v === 'string') {
			parts.push(v)
		} else if (Array.isArray(v)) {
			for (const item of v) {
				if (item) parts.push(item)
			}
		}
	}
	return parts.join(' ')
}

// ─── Sort cycling ────────────────────────────────────────────────────────

function nextSort<TRow extends Record<string, unknown>>(
	current: SortState<TRow> | null,
	field: keyof TRow & string,
): SortState<TRow> | null {
	if (!current || current.field !== field) {
		return { field, direction: 'asc' }
	}
	if (current.direction === 'asc') {
		return { field, direction: 'desc' }
	}
	return null
}

// ─── Row-click safe target check ─────────────────────────────────────────

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label'

function isInteractiveTarget(event: Event): boolean {
	const target = event.target as Element | null
	if (!target) return false
	return target.closest(INTERACTIVE_SELECTOR) !== null
}

// ─── Pagination info builder ─────────────────────────────────────────────

function buildPaginationInfo<TData>(
	data: TData | undefined,
	pageRef: Ref<number>,
	pageSize: number,
	totalRows: (data: TData) => number,
): PaginationInfo {
	const total = data !== undefined ? totalRows(data) : 0
	const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0
	const page = pageRef.value
	const canPrev = page > 1
	const canNext = page < totalPages

	function goTo(target: number): void {
		const clamped = Math.max(1, Math.min(target, totalPages || 1))
		pageRef.value = clamped
	}

	return {
		page,
		totalPages,
		totalRows: total,
		pageSize,
		canPrev,
		canNext,
		goTo,
		prev: () => { if (canPrev) pageRef.value = page - 1 },
		next: () => { if (canNext) pageRef.value = page + 1 },
	}
}

// ─── Default pagination UI ───────────────────────────────────────────────

function renderDefaultPagination(info: PaginationInfo): VNode | null {
	if (info.totalRows === 0) return null

	return h('div', { class: 'vue-dsl-table-pagination' }, [
		h('button', {
			type: 'button',
			class: 'vue-dsl-table-pagination-prev',
			disabled: !info.canPrev,
			onClick: () => info.prev(),
		}, 'Previous'),
		h('span', { class: 'vue-dsl-table-pagination-info' },
			`Page ${info.page} of ${info.totalPages}`),
		h('button', {
			type: 'button',
			class: 'vue-dsl-table-pagination-next',
			disabled: !info.canNext,
			onClick: () => info.next(),
		}, 'Next'),
	])
}

// ─── Header row ──────────────────────────────────────────────────────────

function renderHeader<TRow extends Record<string, unknown>>(
	columns: readonly ColumnDef<TRow>[],
	sortRef: Ref<SortState<TRow> | null> | undefined,
): VNode {
	const cells: VNode[] = columns.map((col) => {
		const isSortable = col.sortable === true && col.key !== undefined
		const sortState = sortRef?.value
		const isActive = isSortable && sortState?.field === col.key
		const direction = isActive ? sortState!.direction : undefined

		const props: Record<string, unknown> = {
			class: classProp(col.headerClass, col.class),
		}

		if (isSortable) {
			props['data-sortable'] = ''
			if (direction) props['data-sort'] = direction
			props.onClick = () => {
				if (!sortRef) return
				sortRef.value = nextSort(sortRef.value, col.key as keyof TRow & string)
			}
		}

		return h('th', props, col.header)
	})

	return h('tr', null, cells)
}

// ─── Body rows ───────────────────────────────────────────────────────────

function renderRows<TRow extends Record<string, unknown>>(
	rows: readonly TRow[],
	columns: readonly ColumnDef<TRow>[],
	rowKey: (row: TRow) => string | number,
	rowClass: ClassValue | ((row: TRow) => ClassValue) | undefined,
	onRowClick: ((row: TRow) => void) | undefined,
): VNode[] {
	return rows.map((row) => {
		const resolvedRowClass: ClassValue =
			typeof rowClass === 'function' ? rowClass(row) : (rowClass ?? null)

		const rowProps: Record<string, unknown> = {
			key: rowKey(row),
			class: classProp('vue-dsl-table-row', resolvedRowClass),
		}

		if (onRowClick) {
			rowProps.onClick = (e: Event) => {
				if (isInteractiveTarget(e)) return
				onRowClick(row)
			}
		}

		const cells: VNode[] = columns.map((col) => {
			let content: VNode | string | number | null = null
			if (col.render) {
				content = col.render(row)
			} else if (col.key !== undefined) {
				const raw = row[col.key]
				if (raw === null || raw === undefined) {
					content = ''
				} else if (typeof raw === 'string' || typeof raw === 'number') {
					content = raw
				} else {
					content = String(raw)
				}
			}

			return h('td', {
				class: classProp(col.cellClass, col.class),
			}, [content])
		})

		return h('tr', rowProps, cells)
	})
}

// ─── Default state slots ─────────────────────────────────────────────────

function renderDefaultLoading(): VNode {
	return h('div', { class: 'vue-dsl-table-loading' }, 'Loading...')
}

function renderDefaultEmpty(): VNode {
	return h('div', { class: 'vue-dsl-table-empty' }, 'No data')
}

function renderDefaultError(error: Error): VNode {
	return h('div', { class: 'vue-dsl-table-error' }, `Error: ${error.message}`)
}

// ─── Table engine ────────────────────────────────────────────────────────

/**
 * Build a table engine — the setup-free core behind {@link useTable}. Owns its
 * own (detached) effect scope so it can be created anywhere, including lazily
 * inside a container's content engine. Call `dispose()` to stop the scope when
 * the owner is done with it ({@link useTable} wires this to `onScopeDispose`; a
 * container engine calls it from its own `dispose`).
 */
export function createTableEngine<TRow extends Record<string, unknown>, TData = readonly TRow[]>(
	node: TableNode<TRow, TData>,
): TableEngine {
	const scope = effectScope(true)

	const isFirstLoad = scope.run(() => computed(() => {
		return node.query.loading.value && node.query.data.value === undefined
	}))!

	const isRefetching = scope.run(() => computed(() => {
		return node.query.loading.value && node.query.data.value !== undefined
	}))!

	function render(): VNode {
		const data = node.query.data.value
		const error = node.query.error.value
		const _loading = node.query.loading.value

		// Build pagination info if pagination is configured
		const paginationInfo: PaginationInfo | null = node.pagination
			? buildPaginationInfo(
				data,
				node.pagination.pageRef,
				node.pagination.pageSize,
				node.pagination.totalRows,
			)
			: null

		// First load: show loading slot
		if (isFirstLoad.value) {
			return h('div', {
				class: classProp('vue-dsl-table-container', node.class),
			}, [node.loadingSlot ? node.loadingSlot() : renderDefaultLoading()])
		}

		// Error state
		if (error) {
			return h('div', {
				class: classProp('vue-dsl-table-container', node.class),
			}, [node.errorSlot ? node.errorSlot(error) : renderDefaultError(error)])
		}

		// Extract rows from data
		const rows: readonly TRow[] = data !== undefined ? node.rows(data) : []

		// Empty state
		if (rows.length === 0) {
			return h('div', {
				class: classProp('vue-dsl-table-container', node.class),
			}, [node.emptySlot ? node.emptySlot() : renderDefaultEmpty()])
		}

		// Main table
		const tableClasses: string[] = ['vue-dsl-table']
		if (isRefetching.value) tableClasses.push('vue-dsl-table--refetching')

		const table = h('table', {
			class: classProp(tableClasses, node.class),
		}, [
			h('thead', null, [renderHeader(node.columns, node.sortRef)]),
			h('tbody', null, renderRows(
				rows,
				node.columns,
				node.rowKey,
				node.rowClass,
				node.onRowClick,
			)),
		])

		const children: VNode[] = [table]

		// Pagination UI
		if (paginationInfo) {
			const paginationVNode: VNode | null = node.paginationSlot
				? node.paginationSlot(paginationInfo)
				: renderDefaultPagination(paginationInfo)
			if (paginationVNode) children.push(paginationVNode)
		}

		return h('div', { class: 'vue-dsl-table-container' }, children)
	}

	return { render, dispose: () => scope.stop() }
}

// ─── useTable composable ─────────────────────────────────────────────────

/**
 * Wrap a table node in a Vue composable. Returns a render function that
 * produces the table's VNode tree, reactive to changes in the underlying
 * query, sort, and pagination state.
 *
 * Thin wrapper over {@link createTableEngine}: binds the engine's `dispose` to
 * the surrounding component scope. Call it from `setup`. For nesting a table
 * inside a container, the container's content engine calls `createTableEngine`
 * directly and manages disposal itself.
 */
export function useTable<TRow extends Record<string, unknown>, TData = readonly TRow[]>(
	node: TableNode<TRow, TData>,
): UseTableReturn {
	const engine = createTableEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}