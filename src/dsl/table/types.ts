import type { Ref, VNode } from 'vue'
import type { QueryReturn } from '../../query/mod.ts'
import type { ClassValue } from '../form/types.ts'

// ─── Sort ────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface SortState<TRow extends Record<string, unknown>> {
	field: keyof TRow & string
	direction: SortDirection
}

// ─── Columns ─────────────────────────────────────────────────────────────

export interface ColumnDef<TRow extends Record<string, unknown>> {
	header: string
	key?: keyof TRow & string
	class?: ClassValue
	headerClass?: ClassValue
	cellClass?: ClassValue
	sortable?: boolean
	render?: (row: TRow) => VNode | string | number | null
}

// ─── Pagination ──────────────────────────────────────────────────────────

export interface PaginationConfig<TData> {
	pageRef: Ref<number>
	pageSize: number
	totalRows: (data: TData) => number
}

export interface PaginationInfo {
	page: number
	totalPages: number
	totalRows: number
	pageSize: number
	canPrev: boolean
	canNext: boolean
	goTo: (page: number) => void
	prev: () => void
	next: () => void
}

// ─── Table node ──────────────────────────────────────────────────────────

export interface TableNode<TRow  extends Record<string, unknown> = Record<string, unknown>, TData = TRow[]> {
	query: QueryReturn<TData>
	rows: (data: TData) => readonly TRow[]
	rowKey: (row: TRow) => string | number
	columns: readonly ColumnDef < TRow > []
	
	sortRef ?: Ref<SortState<TRow> | null>
	pagination ?: PaginationConfig<TData>
	
	class?: ClassValue
	rowClass ?: ClassValue | ((row: TRow) => ClassValue)
	onRowClick ?: (row: TRow) => void

	loadingSlot ?: () => VNode
	emptySlot ?: () => VNode
	errorSlot ?: (error: Error) => VNode
	paginationSlot ?: (info: PaginationInfo) => VNode
}

// ─── useTable return ─────────────────────────────────────────────────────

export interface UseTableReturn {
	render: () => VNode
}