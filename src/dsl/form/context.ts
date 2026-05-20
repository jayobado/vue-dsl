import type { Ref } from 'vue'
import type { ValidationRule } from './types.ts'

/**
 * A single field's rule set, used by the engine when walking the node tree
 * at validation time. The getValue function resolves the field's current
 * value from the form's state, supporting both top-level fields and array
 * row fields (where the key path is more complex).
 */
export interface FieldRuleSet {
	name: string
	rules: readonly ValidationRule[]
	isRequired: boolean
	getValue: (state: Record<string, unknown>) => unknown
}

/**
 * Context passed through the engine when rendering and managing fields.
 *
 * For top-level fields, `keyPrefix` is empty and `state`/`errors` are the
 * form's root refs. For fields inside array rows, the context is wrapped
 * by createRowContext (in array.ts) to translate row-local keys to
 * full state paths.
 */
export interface FieldContext {
	state: Ref<Record<string, unknown>>
	errors: Ref<Record<string, string>>
	touched: Ref<Set<string>>
	keyPrefix: string
	onBlur: (fieldName: string) => void
	validateFields: (keys: readonly string[]) => Promise<boolean>
	triggerSubmit?: () => Promise<void>   // ← new optional field
}