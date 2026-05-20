import { defineComponent, h, type VNode } from 'vue'
import type {
	ArrayNode,
	FormChild,
	ArrayAddSlotContext,
	ArrayRemoveSlotContext,
} from './types.ts'
import type { FieldContext } from './context.ts'

// ─── Row context creation ────────────────────────────────────────────────

/**
 * Create a field context for an array row. The row's context wraps the
 * outer context so that field operations (state writes, blur events,
 * validation) translate from row-local keys to full state paths.
 *
 * Example: a field with name 'quantity' inside row 2 of 'lineItems' has
 * the full key 'lineItems.2.quantity'.
 *
 * The row's state ref points to the row object inside the form's state —
 * mutations propagate up through Vue's deep reactivity. The errors and
 * touched refs are the form's roots; we just translate keys via prefix.
 */
function createRowContext(
	outer: FieldContext,
	arrayKey: string,
	rowIndex: number,
): FieldContext {
	const prefix = `${arrayKey}.${rowIndex}.`

	// The row's state ref is a synthetic view onto the form's state.
	// We construct a ref-like object whose .value points at the row object.
	// Reading state.value.fieldName reads from the row; writing it mutates
	// the row, which (via Vue's proxy) propagates to the form's state.
	const rowStateRef = {
		get value() {
			const array = outer.state.value[arrayKey]
			if (!Array.isArray(array)) return {}
			return (array[rowIndex] ?? {}) as Record<string, unknown>
		},
		set value(_v: Record<string, unknown>) {
			// Replacement of the whole row isn't supported via this synthetic
			// ref — field-level writes go through the proxy directly.
			throw new Error('[vue-dsl] Cannot replace row state directly')
		},
	}

	return {
		state: rowStateRef as unknown as FieldContext['state'],
		errors: outer.errors,
		touched: outer.touched,
		keyPrefix: prefix,
		onBlur: (fieldName) => outer.onBlur(`${prefix}${fieldName}`),
		validateFields: (keys) =>
			outer.validateFields(keys.map((k) => `${prefix}${k}`)),
		triggerSubmit: outer.triggerSubmit,
	}
}

// ─── ArrayRow component ──────────────────────────────────────────────────

/**
 * One row of an array, wrapped as a component for granular reactivity.
 * When state changes for one row's field, only this row's component
 * re-renders — other rows are untouched.
 */
const ArrayRow = defineComponent({
	props: {
		columns: {
			type: Array as () => readonly { header: string; field: FormChild; cellClass?: unknown }[],
			required: true,
		},
		rowCtx: {
			type: Object as () => FieldContext,
			required: true,
		},
		dispatchField: {
			type: Function as unknown as () => (
				node: FormChild,
				ctx: FieldContext,
				state: FieldContext['state'],
			) => VNode | null,
			required: true,
		},
		removeSlot: {
			type: Function as unknown as () => (ctx: ArrayRemoveSlotContext<Record<string, unknown>>) => VNode,
			required: false,
		},
		onRemove: {
			type: Function as unknown as () => () => void,
			required: false,
		},
		rowClass: {
			type: null as unknown as () => unknown,
			required: false,
		},
		row: {
			type: Object as () => Record<string, unknown>,
			required: true,
		},
		rowIndex: {
			type: Number,
			required: true,
		},
	},
	setup(props) {
		return () => {
			const cells: (VNode | null)[] = []

			for (const column of props.columns) {
				const cellVNode = props.dispatchField(
					column.field,
					props.rowCtx,
					props.rowCtx.state,
				)
				cells.push(h('td', {
					class: column.cellClass as string | undefined,
				}, [cellVNode]))
			}

			// Optional remove cell
			if (props.onRemove) {
				const removeVNode: VNode = props.removeSlot
					? (props.removeSlot({
						onRemove: props.onRemove,
						row: props.row,
						rowIndex: props.rowIndex,
					}) as VNode)
					: h('button', {
						type: 'button',
						class: 'vue-dsl-array-remove',
						onClick: props.onRemove,
					}, 'Remove')

				cells.push(h('td', { class: 'vue-dsl-array-remove-cell' }, [removeVNode]))
			}

			return h('tr', {
				class: props.rowClass as string | undefined,
			}, cells)
		}
	},
})

export { ArrayRow, createRowContext }

/**
 * Build the VNode tree for an array node. Produces a table-shaped layout
 * with one ArrayRow component per item in the state array.
 *
 * The engine is responsible for:
 *   - Reading the current array from state
 *   - Generating row contexts with correct deep-path prefixes
 *   - Wiring add/remove handlers
 *   - Rendering header row and (optionally) an add control
 *   - Empty-state messaging when the array has no rows
 */
export function buildArray(
	node: ArrayNode,
	ctx: FieldContext,
	dispatchField: (
		field: FormChild,
		ctx: FieldContext,
		state: FieldContext['state'],
	) => VNode | null,
): VNode {
	const arrayKey = ctx.keyPrefix + node.name

	function getRows(): Record<string, unknown>[] {
		const v = ctx.state.value[node.name]
		return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
	}

	function addRow(): void {
		const rows = getRows()
		const newItem = node.newRow
			? node.newRow()
			: ({} as Record<string, unknown>)
		rows.push(newItem as Record<string, unknown>)
		// Direct mutation works because of Vue's deep reactivity.
		ctx.state.value[node.name] = rows as unknown as never
	}

	function removeRow(index: number): void {
		const rows = getRows()
		if (index < 0 || index >= rows.length) return
		rows.splice(index, 1)
		ctx.state.value[node.name] = rows as unknown as never
	}

	// ─── Header row ────────────────────────────────────────────────────

	const headerCells: VNode[] = node.columns.map((column) =>
		h('th', { class: column.headerClass as string | undefined }, column.header),
	)

	// Add an empty header cell for the remove column, if applicable
	if (node.allowRemove) {
		headerCells.push(h('th', { class: 'vue-dsl-array-remove-header' }, ''))
	}

	const headerRow = h('tr', null, headerCells)
	const thead = h('thead', null, [headerRow])

	// ─── Body rows ─────────────────────────────────────────────────────

	const rows = getRows()
	const bodyVNodes: VNode[] = []

	if (rows.length === 0) {
		const colspan = node.columns.length + (node.allowRemove ? 1 : 0)
		const emptyVNode = h('tr', { class: 'vue-dsl-array-empty-row' }, [
			h('td', { colspan, class: 'vue-dsl-array-empty-cell' },
				node.emptyMessage ?? 'No items'),
		])
		bodyVNodes.push(emptyVNode)
	} else {
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i]
			const rowCtx = createRowContext(ctx, arrayKey, i)
			const key = node.rowKey(row as never, i)

			bodyVNodes.push(h(ArrayRow, {
				key,
				columns: node.columns as readonly { header: string; field: FormChild; cellClass?: unknown }[],
				rowCtx,
				dispatchField,
				removeSlot: node.removeSlot as ((ctx: ArrayRemoveSlotContext<Record<string, unknown>>) => VNode) | undefined,
				onRemove: node.allowRemove ? () => removeRow(i) : undefined,
				rowClass: node.rowClass,
				row,
				rowIndex: i,
			}))
		}
	}

	const tbody = h('tbody', null, bodyVNodes)
	const table = h('table', {
		class: ['vue-dsl-array', node.class as string | undefined],
	}, [thead, tbody])

	// ─── Optional add control ──────────────────────────────────────────

	const children: VNode[] = [table]

	if (node.allowAdd) {
		const addCtx: ArrayAddSlotContext = { onAdd: addRow }
		const addVNode = node.addSlot
			? (node.addSlot(addCtx) as VNode)
			: h('button', {
				type: 'button',
				class: 'vue-dsl-array-add',
				onClick: addRow,
			}, node.addLabel ?? 'Add')
		children.push(addVNode)
	}

	return h('div', { class: 'vue-dsl-array-container' }, children)
}